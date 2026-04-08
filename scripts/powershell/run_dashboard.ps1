$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot/../.."
$Dashboard = Join-Path $Root "frontend/dashboard-blueprint"

if (-not (Test-Path $Dashboard)) {
  throw "Dashboard app not found at $Dashboard"
}

Write-Host "Starting dashboard frontend (dashboard-blueprint) on port 5185..."
Set-Location $Dashboard

if (-not (Test-Path "node_modules")) {
  Write-Host "node_modules missing. Running npm install..."
  if (Test-Path "package-lock.json") {
    npm ci --no-audit --no-fund
  }
  else {
    npm install
  }
}

$nativeRollup = Join-Path $Dashboard "node_modules/@rollup/rollup-win32-x64-msvc"
if ($env:OS -eq "Windows_NT" -and -not (Test-Path $nativeRollup)) {
  Write-Host "Detected missing Windows Rollup optional dependency. Reinstalling node_modules..."
  Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
  if (Test-Path "package-lock.json") {
    npm ci --no-audit --no-fund
  }
  else {
    npm install
  }
}

$existingNode = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -eq 5185 } |
  Select-Object -First 1
if ($existingNode) {
  Write-Host "Clearing previous dev server on port 5185 (PID $($existingNode.OwningProcess))..."
  Stop-Process -Id $existingNode.OwningProcess -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 300
}

# Keep browser origin on localhost for Entra redirect URI consistency.
# API requests go through Vite /api proxy to backend 127.0.0.1:8001.
$env:VITE_API_URL = "/api"
$env:VITE_API_PROXY_TARGET = "http://127.0.0.1:8001"
$env:NO_PROXY = "127.0.0.1,localhost"

npm run dev -- --host --port 5185
