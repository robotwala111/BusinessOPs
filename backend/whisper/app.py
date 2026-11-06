"""Local, OpenAI-compatible Whisper transcription service for Amiro."""

import asyncio
import logging
import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
import av
from faster_whisper import WhisperModel

# PyAV 19+ compatibility: PyAV 19 removed 'metadata_errors' from av.open,
# which faster-whisper still passes. We safely strip it if the installed PyAV rejects it.
_orig_av_open = av.open

def _safe_av_open(*args, **kwargs):
    try:
        return _orig_av_open(*args, **kwargs)
    except TypeError as e:
        if "metadata_errors" in str(e):
            kwargs.pop("metadata_errors", None)
            return _orig_av_open(*args, **kwargs)
        raise

av.open = _safe_av_open

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("amiro-whisper")

MAX_AUDIO_BYTES = 25 * 1024 * 1024
MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "small")
MODEL_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading Whisper model %s on %s (%s)", MODEL_SIZE, MODEL_DEVICE, COMPUTE_TYPE)
    app.state.model = WhisperModel(
        MODEL_SIZE,
        device=MODEL_DEVICE,
        compute_type=COMPUTE_TYPE,
        cpu_threads=max(1, int(os.getenv("WHISPER_CPU_THREADS", str(min(8, os.cpu_count() or 4))))),
        num_workers=1,
    )
    app.state.inference_semaphore = asyncio.Semaphore(1)
    logger.info("Whisper model ready")
    yield


app = FastAPI(title="Amiro Local Whisper", docs_url=None, redoc_url=None, lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_SIZE}


def transcribe_file(path: str, language: str | None):
    segments, info = app.state.model.transcribe(
        path,
        language=language,
        beam_size=1,
        vad_filter=True,
        condition_on_previous_text=False,
    )
    # faster-whisper decodes lazily, so consume segments inside the worker thread.
    text = " ".join(segment.text.strip() for segment in segments if segment.text.strip()).strip()
    return {"text": text, "language": info.language, "language_probability": info.language_probability}


@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    model: str = Form(default="whisper-1"),
    language: str | None = Form(default=None),
):
    del model  # The selected local model is controlled by WHISPER_MODEL_SIZE.

    suffix = Path(file.filename or "speech.webm").suffix or ".webm"
    temp_path: str | None = None
    try:
        payload = await file.read(MAX_AUDIO_BYTES + 1)
        if not payload:
            raise HTTPException(status_code=400, detail="Audio file is empty.")
        if len(payload) > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="Audio file exceeds the 25 MB limit.")

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as audio_file:
            audio_file.write(payload)
            temp_path = audio_file.name

        selected_language = language.strip().lower() if language and language.lower() != "auto" else None
        async with app.state.inference_semaphore:
            return await asyncio.to_thread(transcribe_file, temp_path, selected_language)
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Whisper transcription failed")
        raise HTTPException(status_code=500, detail="Whisper could not transcribe this audio.") from error
    finally:
        if temp_path:
            try:
                os.unlink(temp_path)
            except OSError:
                logger.warning("Could not remove temporary audio file")
        await file.close()
