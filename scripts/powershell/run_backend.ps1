$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot/../.."
$Backend = Join-Path $Root "backend"

Write-Host "Starting backend API on port 8001..."
Set-Location $Backend

$Activate = Join-Path $Backend ".venv/Scripts/Activate.ps1"
if (Test-Path $Activate) {
  . $Activate
}

if (-not $env:DATABASE_URL) {
  $env:DATABASE_URL = "postgresql://b2b:b2b@localhost:5432/b2b"
}

python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
