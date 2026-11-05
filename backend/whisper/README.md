# Free local Whisper speech-to-text

This service runs faster-whisper on the same computer as the Next.js app. It makes no paid transcription API calls. The multilingual Whisper model auto-detects speech language when the widget language is set to Auto; selecting a language sends that language to Whisper as a hint.

Whisper transcribes speech into text. It does not generate spoken audio for the speaker button.

## Start the local service

Use Python 3.10 or newer. The first run downloads the model weights from Hugging Face; the default `small` model is multilingual and is kept in the Hugging Face model cache for later runs.

From this directory, create a virtual environment, install requirements, and start the service:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8001
```

Set `WHISPER_BASE_URL=http://127.0.0.1:8001/v1` in `frontend/.env.local`, then restart Next.js. The Whisper service must remain running while the app is used. It listens on loopback only, so it is not exposed to the network.

## Model and hardware

- `WHISPER_MODEL_SIZE=small` is the default multilingual model. Use `base` for lower memory and faster CPU transcription, or `medium` for better accuracy with more memory and compute.
- `WHISPER_DEVICE=cpu` and `WHISPER_COMPUTE_TYPE=int8` are the default for CPU inference. For a supported NVIDIA setup, set device and compute type according to the installed CTranslate2/CUDA runtime.
- The first request after service start may take longer while the model loads. Later requests reuse the loaded model.
- Speech recognition quality depends on the selected model, audio clarity, language, and accent. “Every language” means the languages supported by Whisper; it cannot guarantee accurate transcription for every language or dialect.
