param(
    [string]$DatabaseUrl = "postgresql+psycopg://b2b:b2b@localhost:5432/b2b",
    [int]$Port = 8000
)

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
$env:DATABASE_URL = $DatabaseUrl

python -m uvicorn app.main:app --reload --host 0.0.0.0 --port $Port
