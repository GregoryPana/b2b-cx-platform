$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot/../.."
$Backend = Join-Path $Root "backend"
$RepoVenvPython = Join-Path $Root ".venv/Scripts/python.exe"
$BackendVenvPython = Join-Path $Backend ".venv/Scripts/python.exe"

Write-Host "Starting backend API on port 8001..."
Set-Location $Backend

# Clear stale listener on backend port to avoid bind failures
$existing = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -eq 8001 } |
  Select-Object -First 1
if ($existing) {
  Stop-Process -Id $existing.OwningProcess -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 300
}

if (Test-Path $RepoVenvPython) {
  $PythonExe = $RepoVenvPython
} elseif (Test-Path $BackendVenvPython) {
  $PythonExe = $BackendVenvPython
} else {
  throw "Python venv not found. Expected one of: $RepoVenvPython or $BackendVenvPython"
}

# Prefer explicit shell variables; otherwise backend loads from .env automatically.
if (-not $env:DATABASE_URL -and $env:LOCAL_DATABASE_URL) {
  $env:DATABASE_URL = $env:LOCAL_DATABASE_URL
}

$env:PYTHONPATH = $Backend

# Microsoft Entra Authentication Configuration
if (-not $env:ENTRA_TENANT_ID) {
  $env:ENTRA_TENANT_ID = "97df7dc2-f178-4ce4-b55e-bcafc144485e"
}
if (-not $env:ENTRA_CLIENT_ID) {
  $env:ENTRA_CLIENT_ID = "7e09a8c1-f113-4e3f-aeb7-21d1305cbd55"
}
if (-not $env:ENTRA_AUTHORITY) {
  $env:ENTRA_AUTHORITY = "https://login.microsoftonline.com/$env:ENTRA_TENANT_ID"
}
if (-not $env:ENTRA_ISSUER) {
  $env:ENTRA_ISSUER = "$env:ENTRA_AUTHORITY/v2.0"
}
if (-not $env:ENTRA_AUDIENCE) {
  $env:ENTRA_AUDIENCE = "api://7e09a8c1-f113-4e3f-aeb7-21d1305cbd55"
}

# Keep console output safe on Windows codepages
$env:PYTHONUTF8 = "1"

Write-Host "Running Alembic migrations before startup..."
& $PythonExe -m alembic -c .\alembic.ini upgrade head

if ($env:DATABASE_URL) {
  Write-Host ("Using DATABASE_URL from environment: " + $env:DATABASE_URL)
} else {
  Write-Host "DATABASE_URL not set in shell; backend will load it from .env"
}

if ($env:ENVIRONMENT) {
  Write-Host ("Using ENVIRONMENT=" + $env:ENVIRONMENT)
} else {
  Write-Host "ENVIRONMENT not set in shell; backend will load it from .env"
}

& $PythonExe -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --no-access-log --log-level warning --timeout-keep-alive 5
