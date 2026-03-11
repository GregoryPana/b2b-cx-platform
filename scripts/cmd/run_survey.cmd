@echo off
setlocal

set "ROOT=%~dp0..\.."
set "SURVEY=%ROOT%\frontend\survey"

echo Starting survey frontend on port 5176...
cd /d "%SURVEY%"
npm run dev -- --host --port 5176

endlocal
