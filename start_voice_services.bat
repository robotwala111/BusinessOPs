@echo off
echo ========================================================
echo   Starting Amiro Voice Services (Whisper + Piper)
echo ========================================================

start "Amiro Whisper STT (Port 8001)" cmd /c "cd /d %~dp0backend\whisper && .\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8001"
start "Amiro Piper TTS (Port 8002)" cmd /c "cd /d %~dp0backend\piper && .\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8002"

echo Services started:
echo   - Whisper (Speech-to-Text): http://127.0.0.1:8001/health
echo   - Piper (Text-to-Speech):   http://127.0.0.1:8002/health
pause
