@echo off
setlocal

set "ROOT=%~dp0..\.."
set "BACKEND=%ROOT%\backend"

echo Starting backend API on port 8001...
cd /d "%BACKEND%"

if exist ".venv\Scripts\activate.bat" (
  call ".venv\Scripts\activate.bat"
)

if "%DATABASE_URL%"=="" (
  set "DATABASE_URL=postgresql://b2b:b2b@localhost:5432/b2b"
)

python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

endlocal
