@echo off
setlocal

set ROOT=%~dp0..\..
for %%I in ("%ROOT%") do set ROOT=%%~fI
cd /d %ROOT%

if not exist .venv\Scripts\activate.bat (
  echo Virtual environment not found. Run: python -m venv .venv
  exit /b 1
)

call .venv\Scripts\activate.bat
set PYTHONPATH=backend

if "%DATABASE_URL%"=="" (
  set DATABASE_URL=postgresql+psycopg://b2b:b2b@localhost:5432/b2b
)

python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
