@echo off
setlocal

set "ROOT=%~dp0..\.."
powershell -ExecutionPolicy Bypass -File "%ROOT%\scripts\powershell\smoke_mystery_shopper.ps1"

endlocal
