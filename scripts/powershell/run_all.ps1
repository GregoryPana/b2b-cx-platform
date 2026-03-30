$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot/../.."
$Scripts = Join-Path $Root "scripts/powershell"
$ComposeFile = Join-Path $Root "docker-compose.dev.yml"
$Ports = @(8001, 5185, 5176, 5177)

function Stop-ExistingPortListeners {
  param([int[]]$TargetPorts)

  $pids = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $TargetPorts -contains $_.LocalPort } |
    Select-Object -ExpandProperty OwningProcess -Unique

  if (-not $pids) {
    Write-Host "No existing listeners found on target ports."
    return
  }

  foreach ($id in $pids) {
    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
  }
  Write-Host ("Stopped existing listener PIDs: " + ($pids -join ", "))
}

function Wait-ForHttp {
  param(
    [string]$Url,
    [int]$MaxAttempts = 30,
    [int]$DelaySeconds = 1
  )

  for ($i = 1; $i -le $MaxAttempts; $i++) {
    try {
      $resp = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 5
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
        Write-Host ("Ready: " + $Url + " (" + $resp.StatusCode + ")")
        return $true
      }
    } catch {
      # keep retrying
    }
    Start-Sleep -Seconds $DelaySeconds
  }

  Write-Host ("Timeout waiting for " + $Url)
  return $false
}

function Start-ServiceWindow {
  param([string]$ScriptPath)

  Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", $ScriptPath | Out-Null
}

Write-Host "Starting all services (DB + backend + dashboard + survey + mystery shopper)..."
Set-Location $Root

Stop-ExistingPortListeners -TargetPorts $Ports

Write-Host "Starting database container..."
docker compose -f $ComposeFile up -d

Write-Host "Waiting for database readiness..."
$dbReady = $false
for ($i = 1; $i -le 30; $i++) {
  try {
    docker compose -f $ComposeFile exec -T db pg_isready -U b2b -d b2b | Out-Null
    $dbReady = $true
    break
  } catch {
    Start-Sleep -Seconds 1
  }
}
if (-not $dbReady) {
  throw "Database did not become ready in time."
}
Write-Host "Database is ready."

$backendScript = Join-Path $Scripts "run_backend.ps1"
$dashboardScript = Join-Path $Scripts "run_dashboard.ps1"
$surveyScript = Join-Path $Scripts "run_survey.ps1"
$mysteryScript = Join-Path $Scripts "run_mystery_shopper.ps1"

Write-Host "Launching backend..."
Start-ServiceWindow -ScriptPath $backendScript
if (-not (Wait-ForHttp -Url "http://127.0.0.1:8001/health" -MaxAttempts 45 -DelaySeconds 1)) {
  throw "Backend health check failed on http://127.0.0.1:8001/health"
}

Write-Host "Launching frontends..."
Start-ServiceWindow -ScriptPath $dashboardScript
Start-ServiceWindow -ScriptPath $surveyScript
Start-ServiceWindow -ScriptPath $mysteryScript

$dashboardReady = Wait-ForHttp -Url "http://127.0.0.1:5185" -MaxAttempts 45 -DelaySeconds 1
$surveyReady = Wait-ForHttp -Url "http://127.0.0.1:5176" -MaxAttempts 45 -DelaySeconds 1
$mysteryReady = Wait-ForHttp -Url "http://127.0.0.1:5177" -MaxAttempts 45 -DelaySeconds 1

Write-Host "All service windows launched."
Write-Host "Backend:   http://127.0.0.1:8001"
Write-Host "Dashboard: http://127.0.0.1:5185"
Write-Host "Survey:    http://127.0.0.1:5176"
Write-Host "Mystery:   http://127.0.0.1:5177"

if (-not ($dashboardReady -and $surveyReady -and $mysteryReady)) {
  Write-Host "One or more frontend health checks did not complete in time. Check spawned terminal windows for errors."
}
