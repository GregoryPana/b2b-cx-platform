@echo off
setlocal

set "ROOT=%~dp0..\.."

REM Delegate to comprehensive PowerShell startup flow
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\powershell\run_all.ps1"
if errorlevel 1 (
  echo.
  echo Comprehensive startup failed. Check output above.
  exit /b 1
)

echo.
echo Startup completed via PowerShell orchestration.
echo Backend:   http://localhost:8001
echo Dashboard: http://localhost:5175
echo Survey:    http://localhost:5176
echo Mystery:   http://localhost:5177

endlocal
exit /b 0
