param(
  [switch]$UseDevBypass,
  [string]$AccessToken,
  [switch]$StartSurvey,
  [switch]$StartMystery,
  [string]$LocalDbUrl
)

$ErrorActionPreference = "Stop"

if (-not $LocalDbUrl) {
  $LocalDbUrl = "postgresql://b2b:b2b@127.0.0.1:5432/b2b"
}

$Root = Resolve-Path "$PSScriptRoot/../.."
$Scripts = Join-Path $Root "scripts/powershell"
$ComposeFile = Join-Path $Root "docker-compose.dev.yml"

$backendScript = Join-Path $Scripts "run_backend.ps1"
$dashboardScript = Join-Path $Scripts "run_dashboard.ps1"
$surveyScript = Join-Path $Scripts "run_survey.ps1"
$mysteryScript = Join-Path $Scripts "run_mystery_shopper.ps1"
$verifyScript = Join-Path $Scripts "tdd_verify.ps1"

function Write-Step {
  param([string]$Message)
  Write-Host "`n=== $Message ==="
}

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

function Start-ServiceWindow {
  param([string]$ScriptPath)
  Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", $ScriptPath | Out-Null
}

function Wait-ForUrl {
  param(
    [string]$Url,
    [int]$MaxAttempts = 30,
    [int]$DelaySeconds = 1
  )

  for ($i = 1; $i -le $MaxAttempts; $i++) {
    $raw = & curl.exe --max-time 3 --silent --show-error $Url 2>$null
    if ($LASTEXITCODE -eq 0 -and $raw) {
      Write-Host ("Ready: " + $Url)
      return $true
    }
    Start-Sleep -Seconds $DelaySeconds
  }

  Write-Host ("Timeout waiting for " + $Url)
  return $false
}

Write-Step "Set auth/profile mode"
if ($UseDevBypass) {
  $env:ENVIRONMENT = "dev"
  $env:DEV_AUTH_BYPASS = "true"
  $env:VITE_DEV_AUTH_BYPASS = "true"
  $env:VITE_DEV_BYPASS_ROLES = "CX_SUPER_ADMIN,B2B_ADMIN,MYSTERY_ADMIN,INSTALL_ADMIN,B2B_SURVEYOR,MYSTERY_SURVEYOR,INSTALL_SURVEYOR"
  Write-Host "Using DEV auth bypass mode"
} else {
  if (-not $env:ENVIRONMENT) {
    $env:ENVIRONMENT = "staging"
  }
  Remove-Item Env:DEV_AUTH_BYPASS -ErrorAction SilentlyContinue
  Remove-Item Env:VITE_DEV_AUTH_BYPASS -ErrorAction SilentlyContinue
  Remove-Item Env:VITE_DEV_BYPASS_ROLES -ErrorAction SilentlyContinue
  Write-Host "Using staging auth mode"
}

$env:LOCAL_DATABASE_URL = $LocalDbUrl
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue

Write-Step "Stop existing listeners"
Stop-ExistingPortListeners -TargetPorts @(8001, 5185, 5176, 5177)

Write-Step "Ensure database container"
Set-Location $Root
docker compose -f $ComposeFile up -d

Write-Step "Wait for database readiness"
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

Write-Step "Launch backend + dashboard"
Start-ServiceWindow -ScriptPath $backendScript
Start-ServiceWindow -ScriptPath $dashboardScript
if ($StartSurvey) {
  Start-ServiceWindow -ScriptPath $surveyScript
}
if ($StartMystery) {
  Start-ServiceWindow -ScriptPath $mysteryScript
}

Write-Step "Wait for services"
if (-not (Wait-ForUrl -Url "http://127.0.0.1:8001/health" -MaxAttempts 45 -DelaySeconds 1)) {
  throw "Backend did not become healthy."
}
if (-not (Wait-ForUrl -Url "http://127.0.0.1:5185" -MaxAttempts 45 -DelaySeconds 1)) {
  throw "Dashboard dev server did not become ready."
}

Write-Step "Run TDD verification"
$verifyArgs = @(
  "-ApiBase", "http://127.0.0.1:8001",
  "-DbUrl", $LocalDbUrl,
  "-AppendTracklist"
)
if ($UseDevBypass) {
  $verifyArgs += "-UseDevBypass"
} elseif ($AccessToken) {
  $verifyArgs += @("-AccessToken", $AccessToken)
}

& powershell -ExecutionPolicy Bypass -File $verifyScript @verifyArgs

Write-Step "Cycle complete"
Write-Host "Services:"
Write-Host "- Backend:   http://127.0.0.1:8001"
Write-Host "- Dashboard: http://127.0.0.1:5185"
if ($StartSurvey) { Write-Host "- Survey:    http://127.0.0.1:5176" }
if ($StartMystery) { Write-Host "- Mystery:   http://127.0.0.1:5177" }
