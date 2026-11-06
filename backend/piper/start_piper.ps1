$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Starting Amiro Piper Text-to-Speech Service" -ForegroundColor Cyan
Write-Host "  URL: http://127.0.0.1:8002" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

& ".\.venv\Scripts\python.exe" -m uvicorn app:app --host 127.0.0.1 --port 8002
