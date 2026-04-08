$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot/../.."
$Survey = Join-Path $Root "frontend/survey"

if (-not (Test-Path $Survey)) {
  throw "Survey app not found at $Survey"
}

Write-Host "Starting survey frontend on port 5176..."
Set-Location $Survey

$nativeRollup = Join-Path $Survey "node_modules/@rollup/rollup-win32-x64-msvc"
$needInstall = -not (Test-Path "node_modules")

if (-not $needInstall -and $env:OS -eq "Windows_NT" -and -not (Test-Path $nativeRollup)) {
  Write-Host "Detected missing Windows Rollup optional dependency. Reinstalling node_modules..."
  Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
  $needInstall = $true
}

if ($needInstall) {
  if (Test-Path "package-lock.json") {
    Write-Host "Installing dependencies with npm ci..."
    npm ci --no-audit --no-fund
  }
  else {
    Write-Host "package-lock.json not found. Running npm install..."
    npm install
  }
}

$existingNode = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -eq 5176 } |
  Select-Object -First 1
if ($existingNode) {
  Write-Host "Clearing previous dev server on port 5176 (PID $($existingNode.OwningProcess))..."
  Stop-Process -Id $existingNode.OwningProcess -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 300
}

$env:VITE_API_URL = "/api"
$env:VITE_API_PROXY_TARGET = "http://127.0.0.1:8001"
$env:NO_PROXY = "127.0.0.1,localhost"

npm run dev -- --host --port 5176
