# Local Piper text-to-speech

This service reads assistant replies aloud on the same computer as the app. It is separate from Whisper, which remains the microphone transcription service.

The included Piper voice mapping is:

| Language | Voice |
| --- | --- |
| English | `en_US-lessac-medium` |
| Hindi | `hi_IN-pratham-medium` |
| Telugu | `te_IN-maya-medium` |
| Malayalam | `ml_IN-meera-medium` |

The standard Piper voice list does not include Tamil or Kannada. For those, the widget uses a browser voice only when the browser has a matching language voice installed; it never substitutes English.

## Install voices

From PowerShell in `backend/piper` (using `uv`, available in this workspace):

```powershell
uv venv --python 3.14 .venv
uv pip install --python .venv\Scripts\python.exe -r requirements.txt
.\.venv\Scripts\Activate.ps1
python -m piper.download_voices en_US-lessac-medium hi_IN-pratham-medium te_IN-maya-medium ml_IN-meera-medium --download-dir voices
```

Voice files are downloaded from the Piper voices repository. Check each voice's model card for its license before distributing it.

## Run

From PowerShell in `backend/piper`:

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn app:app --host 127.0.0.1 --port 8002
```

Set `PIPER_BASE_URL=http://127.0.0.1:8002` in `frontend/.env.local` and restart Next.js. The API loads a voice on its first request and keeps it in memory for later requests.

Check the service at `http://127.0.0.1:8002/health`.
