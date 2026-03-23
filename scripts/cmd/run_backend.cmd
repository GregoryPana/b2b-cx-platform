@echo off
setlocal

set "ROOT=%~dp0..\.."
set "BACKEND=%ROOT%\backend"

echo Starting backend API on port 8001...
cd /d "%BACKEND%"

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8001" ^| findstr "LISTENING"') do (
  taskkill /PID %%p /F >nul 2>&1
)

if exist ".venv\Scripts\activate.bat" (
  call ".venv\Scripts\activate.bat"
)

if "%DATABASE_URL%"=="" (
  set "DATABASE_URL=postgresql://b2b:b2b@localhost:5432/b2b"
)

REM Microsoft Entra Authentication Configuration
if "%ENTRA_TENANT_ID%"=="" (
  set "ENTRA_TENANT_ID=97df7dc2-f178-4ce4-b55e-bcafc144485e"
)
if "%ENTRA_CLIENT_ID%"=="" (
  set "ENTRA_CLIENT_ID=7e09a8c1-f113-4e3f-aeb7-21d1305cbd55"
)
if "%ENTRA_AUTHORITY%"=="" (
  set "ENTRA_AUTHORITY=https://login.microsoftonline.com/%ENTRA_TENANT_ID%"
)
if "%ENTRA_ISSUER%"=="" (
  set "ENTRA_ISSUER=%ENTRA_AUTHORITY%/v2.0"
)
if "%ENTRA_AUDIENCE%"=="" (
  set "ENTRA_AUDIENCE=api://7e09a8c1-f113-4e3f-aeb7-21d1305cbd55"
)

set "PYTHONUTF8=1"

python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --no-access-log --log-level warning --timeout-keep-alive 5

endlocal
