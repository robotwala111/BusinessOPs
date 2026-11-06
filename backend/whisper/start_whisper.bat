@echo off
cd /d "%~dp0"
echo ========================================================
echo   Starting Amiro Whisper Speech-to-Text Service
echo   Port: 8001 ^| Host: 127.0.0.1
echo ========================================================
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8001
pause
