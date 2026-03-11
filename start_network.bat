@echo off
setlocal

echo Starting CX B2B Platform for network access...
echo.
echo Note: this launcher now delegates to scripts\cmd\run_all.cmd
echo.

cd /d "%~dp0"
call "scripts\cmd\run_all.cmd"

endlocal
