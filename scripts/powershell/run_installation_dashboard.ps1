$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot/../.."
$BackendScript = Join-Path $Root "scripts/powershell/run_backend.ps1"
$FrontendDir = Join-Path $Root "frontend/survey"

if (-not (Test-Path $FrontendDir)) {
  throw "Installation survey frontend not found at $FrontendDir"
}

if (Test-Path $BackendScript) {
  Write-Host "Launching backend API window..."
  Start-Process powershell -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-File",$BackendScript | Out-Null
  Start-Sleep -Seconds 2
}

Write-Host "Preparing Installation Assessment survey (port 5181)..."
Set-Location $FrontendDir

if (-not (Test-Path "node_modules")) {
  Write-Host "node_modules missing. Running npm install..."
  if (Test-Path "package-lock.json") {
    npm ci --no-audit --no-fund
  }
  else {
    npm install
  }
}

$nativeRollup = Join-Path $FrontendDir "node_modules/@rollup/rollup-win32-x64-msvc"
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

$env:VITE_DISABLE_TYPECHECK = "true"
$env:VITE_API_URL = "/api"
$env:VITE_API_PROXY_TARGET = "http://127.0.0.1:8001"
$env:VITE_SURVEY_TYPE = "Installation Assessment"
$env:VITE_BASE_PATH = "/"
$env:NO_PROXY = "127.0.0.1,localhost"

$existingNode = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -eq 5181 } |
  Select-Object -First 1
if ($existingNode) {
  Write-Host "Clearing previous dev server on port 5181 (PID $($existingNode.OwningProcess))..."
  Stop-Process -Id $existingNode.OwningProcess -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 300
}

$frontendCommand = "$env:VITE_DISABLE_TYPECHECK='true'; $env:VITE_API_URL='/api'; $env:VITE_API_PROXY_TARGET='http://127.0.0.1:8001'; $env:VITE_SURVEY_TYPE='Installation Assessment'; $env:VITE_BASE_PATH='/'; $env:NO_PROXY='127.0.0.1,localhost'; Set-Location '$FrontendDir'; npm run dev -- --host --port 5181"
Write-Host "Starting Vite dev server in a new window..."
Start-Process powershell -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-Command",$frontendCommand | Out-Null

Start-Sleep -Seconds 3
Write-Host "Opening http://localhost:5181/ in your default browser..."
Start-Process "http://localhost:5181/"

Write-Host "Installation survey launch sequence complete. Leave the spawned terminals open to keep services running."
