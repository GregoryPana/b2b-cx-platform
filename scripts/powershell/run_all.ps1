param(
    [string]$DatabaseUrl = "postgresql+psycopg://b2b:b2b@localhost:5432/b2b"
)

$ErrorActionPreference = "Stop"

$root = Join-Path $PSScriptRoot "..\.."

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $root; .\scripts\powershell\run_backend.ps1 -DatabaseUrl '$DatabaseUrl'"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $root; .\scripts\powershell\run_survey.ps1"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd $root; .\scripts\powershell\run_dashboard.ps1"
