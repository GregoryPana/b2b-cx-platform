$ErrorActionPreference = "Stop"

$root = Join-Path $PSScriptRoot "..\.."
Set-Location $root

$venvPath = Join-Path $root ".venv\Scripts\Activate.ps1"
if (-not (Test-Path $venvPath)) {
    Write-Error "Virtual environment not found. Run: python -m venv .venv"
    exit 1
}

. $venvPath

$env:PYTHONPATH = "backend"

python backend/scripts/seed.py
