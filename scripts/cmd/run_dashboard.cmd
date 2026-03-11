@echo off
setlocal

set "ROOT=%~dp0..\.."
set "DASHBOARD=%ROOT%\frontend\dashboard"

echo Starting dashboard frontend on port 5175...
cd /d "%DASHBOARD%"
npm run dev -- --host --port 5175

endlocal
