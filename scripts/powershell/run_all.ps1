$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot/../.."
$Scripts = Join-Path $Root "scripts/powershell"

Write-Host "Starting all services (DB + backend + dashboard + survey + mystery shopper)..."
Set-Location $Root
docker compose -f docker-compose.dev.yml up -d

Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $Scripts "run_backend.ps1")
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $Scripts "run_dashboard.ps1")
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $Scripts "run_survey.ps1")
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $Scripts "run_mystery_shopper.ps1")

Write-Host "All service windows launched."
Write-Host "Backend:   http://localhost:8001"
Write-Host "Dashboard: http://localhost:5175"
Write-Host "Survey:    http://localhost:5176"
Write-Host "Mystery:   http://localhost:5177"
