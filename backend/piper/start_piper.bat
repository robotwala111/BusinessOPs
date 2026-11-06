@echo off
cd /d "%~dp0"
echo ========================================================
echo   Starting Amiro Piper Text-to-Speech Service
echo   Port: 8002 ^| Host: 127.0.0.1
echo ========================================================
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8002
pause
