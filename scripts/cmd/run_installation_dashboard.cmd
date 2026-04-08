@echo off
setlocal

set "ROOT=%~dp0..\.."
powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\powershell\run_installation_dashboard.ps1"

endlocal
exit /b %errorlevel%
