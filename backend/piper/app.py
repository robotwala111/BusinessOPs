"""Local Piper TTS service for Amiro reply playback."""

import asyncio
import io
import logging
import os
import wave
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from piper import PiperVoice
from pydantic import BaseModel, Field

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("amiro-piper")

VOICE_DIR = Path(os.getenv("PIPER_VOICE_DIR", str(Path(__file__).resolve().parent / "voices"))).resolve()
VOICE_BY_LANGUAGE = {
    "en": "en_US-lessac-medium",
    "hi": "hi_IN-pratham-medium",
    "te": "te_IN-maya-medium",
    "ml": "ml_IN-meera-medium",
}
MAX_TEXT_LENGTH = 5000


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.voices = {}
    app.state.voice_lock = asyncio.Lock()
    app.state.inference_lock = asyncio.Lock()
    logger.info("Piper TTS service started; voices will load on first request from %s", VOICE_DIR)
    yield


app = FastAPI(title="Amiro Local Piper TTS", docs_url=None, redoc_url=None, lifespan=lifespan)


class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TEXT_LENGTH)
    language: str = Field(min_length=2, max_length=8)


async def get_voice(language: str) -> PiperVoice:
    voice_name = VOICE_BY_LANGUAGE[language]
    async with app.state.voice_lock:
        cached = app.state.voices.get(voice_name)
        if cached is not None:
            return cached

        model_path = VOICE_DIR / f"{voice_name}.onnx"
        if not model_path.is_file() or not Path(f"{model_path}.json").is_file():
            raise HTTPException(
                status_code=503,
                detail=f"Piper voice {voice_name} is not installed. Follow backend/piper/README.md to download it.",
            )

        try:
            voice = await asyncio.to_thread(PiperVoice.load, str(model_path))
        except Exception as error:
            logger.exception("Could not load Piper voice %s", voice_name)
            raise HTTPException(status_code=503, detail=f"Piper voice {voice_name} could not be loaded.") from error
        app.state.voices[voice_name] = voice
        return voice


def synthesize_wav(voice: PiperVoice, text: str) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        voice.synthesize_wav(text, wav_file)
    audio = buffer.getvalue()
    if len(audio) <= 44:
        raise RuntimeError("Piper generated empty audio")
    return audio


@app.get("/health")
async def health():
    installed = {
        language: voice_name
        for language, voice_name in VOICE_BY_LANGUAGE.items()
        if (VOICE_DIR / f"{voice_name}.onnx").is_file()
        and Path(f"{VOICE_DIR / voice_name}.onnx.json").is_file()
    }
    return {
        "status": "ready" if installed else "voices_missing",
        "engine": "piper-tts",
        "installed_languages": sorted(installed),
        "supported_languages": sorted(VOICE_BY_LANGUAGE),
    }


@app.post("/v1/audio/speech")
async def speak(request: SpeechRequest):
    language = request.language.lower().split("-")[0].split("_")[0]
    if language not in VOICE_BY_LANGUAGE:
        raise HTTPException(
            status_code=422,
            detail=f"No bundled Piper voice for {language}. Install a matching browser voice to read this language aloud.",
        )

    voice = await get_voice(language)
    async with app.state.inference_lock:
        try:
            wav_bytes = await asyncio.to_thread(synthesize_wav, voice, request.text.strip())
        except Exception as error:
            logger.exception("Piper synthesis failed for language %s", language)
            raise HTTPException(status_code=500, detail="Piper could not synthesize this reply.") from error

    return Response(content=wav_bytes, media_type="audio/wav", headers={"Cache-Control": "private, no-store"})
