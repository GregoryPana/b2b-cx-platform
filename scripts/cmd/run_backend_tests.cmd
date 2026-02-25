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

python -m pytest backend/tests
