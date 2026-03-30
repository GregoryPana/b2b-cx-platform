$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot/../.."
$Dashboard = Join-Path $Root "frontend/dashboard-blueprint"

if (-not (Test-Path $Dashboard)) {
  throw "Dashboard app not found at $Dashboard"
}

Write-Host "Starting dashboard frontend (dashboard-blueprint) on port 5185..."
Set-Location $Dashboard

# Keep browser origin on localhost for Entra redirect URI consistency.
# API requests go through Vite /api proxy to backend 127.0.0.1:8001.
$env:VITE_API_URL = "/api"
$env:VITE_API_PROXY_TARGET = "http://127.0.0.1:8001"
$env:NO_PROXY = "127.0.0.1,localhost"

npm run dev -- --host --port 5185
