@echo off
setlocal

set ROOT=%~dp0..\..
for %%I in ("%ROOT%") do set ROOT=%%~fI

start "backend" cmd /k "cd /d %ROOT% && scripts\cmd\run_backend.cmd"
start "survey" cmd /k "cd /d %ROOT% && scripts\cmd\run_survey.cmd"
start "dashboard" cmd /k "cd /d %ROOT% && scripts\cmd\run_dashboard.cmd"
