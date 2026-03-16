@echo off
setlocal

set "ROOT=%~dp0..\.."
set "MYSTERY=%ROOT%\frontend\mystery-shopper"

echo Starting Mystery Shopper frontend on port 5177...
cd /d "%MYSTERY%"
npm run dev -- --host --port 5177

endlocal
