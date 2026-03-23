$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot/../.."
$Backend = Join-Path $Root "backend"

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

$Activate = Join-Path $Backend ".venv/Scripts/Activate.ps1"
if (Test-Path $Activate) {
  . $Activate
}

if (-not $env:DATABASE_URL) {
  $env:DATABASE_URL = "postgresql://b2b:b2b@localhost:5432/b2b"
}

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

python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --no-access-log --log-level warning --timeout-keep-alive 5
