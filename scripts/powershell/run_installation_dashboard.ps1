$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot/../.."
$BackendScript = Join-Path $Root "scripts/powershell/run_backend.ps1"
$FrontendDir = Join-Path $Root "frontend/installation-dashboard"

Write-Host "Launching backend API window..."
Start-Process powershell -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-File","$BackendScript" | Out-Null

Write-Host "Preparing Installation field dashboard (port 5181)..."
Set-Location $FrontendDir

if (-not (Test-Path "node_modules")) {
  Write-Host "node_modules missing. Running npm install..."
  npm install
}

$env:VITE_DISABLE_TYPECHECK = "true"

$existingNode = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -eq 5181 } |
  Select-Object -First 1
if ($existingNode) {
  Write-Host "Clearing previous dev server on port 5181 (PID $($existingNode.OwningProcess))..."
  Stop-Process -Id $existingNode.OwningProcess -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 300
}

$frontendCommand = "Set-Location '$FrontendDir'; npm run dev -- --host --port 5181"
Write-Host "Starting Vite dev server in a new window..."
Start-Process powershell -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-Command",$frontendCommand | Out-Null

Start-Sleep -Seconds 3
Write-Host "Opening http://localhost:5181/ in your default browser..."
Start-Process "http://localhost:5181/"

Write-Host "Installation dashboard launch sequence complete. Leave the spawned terminals open to keep services running."
