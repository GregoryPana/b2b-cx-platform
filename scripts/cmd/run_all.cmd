@echo off
setlocal

set "ROOT=%~dp0..\.."

echo Starting all services (DB + backend + dashboard + survey + mystery shopper)...
cd /d "%ROOT%"

docker compose -f docker-compose.dev.yml up -d

start "CX Backend" cmd /k "%ROOT%\scripts\cmd\run_backend.cmd"
start "CX Dashboard" cmd /k "%ROOT%\scripts\cmd\run_dashboard.cmd"
start "CX Survey" cmd /k "%ROOT%\scripts\cmd\run_survey.cmd"
start "CX Mystery Shopper" cmd /k "%ROOT%\scripts\cmd\run_mystery_shopper.cmd"

echo All service windows launched.
echo Backend:   http://localhost:8001
echo Dashboard: http://localhost:5175
echo Survey:    http://localhost:5176
echo Mystery:   http://localhost:5177

endlocal
