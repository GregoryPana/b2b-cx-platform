Param(
    [string]$OutputZip = ""
)

$ErrorActionPreference = "Stop"

# Component build toggles (CI/CD can set these as env vars).
# Defaults:
# - Backend: build
# - Dashboard (blueprint): build
# - Surveys (b2b + installation): build
# - Mystery shopper: skip (later phase)
function Get-BoolEnv {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][bool]$Default
    )
    $raw = (Get-Item -Path "Env:$Name" -ErrorAction SilentlyContinue).Value
    if ([string]::IsNullOrWhiteSpace($raw)) {
        return $Default
    }
    switch ($raw.Trim().ToLowerInvariant()) {
        "1" { return $true }
        "true" { return $true }
        "yes" { return $true }
        "0" { return $false }
        "false" { return $false }
        "no" { return $false }
        default { return $Default }
    }
}

$BuildBackend = Get-BoolEnv -Name "BUILD_BACKEND" -Default $true
$BuildDashboard = Get-BoolEnv -Name "BUILD_DASHBOARD" -Default $true
$BuildSurveys = Get-BoolEnv -Name "BUILD_SURVEYS" -Default $true
$BuildMysteryShopper = Get-BoolEnv -Name "BUILD_MYSTERY_SHOPPER" -Default $false

function Invoke-External {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [Parameter(Mandatory = $false)][string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed ($LASTEXITCODE): $Command $($Arguments -join ' ')"
    }
}

function Build-Frontend {
    param(
        [Parameter(Mandatory = $true)][string]$AppPath,
        [Parameter(Mandatory = $true)][string]$BasePath
    )

    Push-Location $AppPath
    try {
        Invoke-External -Command "npm" -Arguments @("ci", "--no-audit", "--no-fund")
        $env:VITE_API_URL = "/api"
        $env:VITE_BASE_PATH = $BasePath
        Invoke-External -Command "npm" -Arguments @("run", "build")
        if (-not (Test-Path "dist\index.html")) {
            throw "Build output missing: $AppPath\dist\index.html"
        }
    }
    finally {
        Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue
        Remove-Item Env:VITE_BASE_PATH -ErrorAction SilentlyContinue
        Pop-Location
    }
}

function Copy-BackendRelease {
    param(
        [Parameter(Mandatory = $true)][string]$RepoRoot,
        [Parameter(Mandatory = $true)][string]$ReleaseRoot
    )

    $backendReleasePath = Join-Path $ReleaseRoot "backend"
    New-Item -ItemType Directory -Path $backendReleasePath | Out-Null

    Copy-Item (Join-Path $RepoRoot "backend" "app") (Join-Path $backendReleasePath "app") -Recurse -Force
    Copy-Item (Join-Path $RepoRoot "backend" "alembic") (Join-Path $backendReleasePath "alembic") -Recurse -Force
    Copy-Item (Join-Path $RepoRoot "backend" "scripts") (Join-Path $backendReleasePath "scripts") -Recurse -Force
    Copy-Item (Join-Path $RepoRoot "backend" "requirements.txt") (Join-Path $backendReleasePath "requirements.txt") -Force
    Copy-Item (Join-Path $RepoRoot "backend" "alembic.ini") (Join-Path $backendReleasePath "alembic.ini") -Force
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\.." )).Path
$TempRoot = $env:RUNNER_TEMP
if ([string]::IsNullOrWhiteSpace($TempRoot)) {
    $TempRoot = $env:TEMP
}
if ([string]::IsNullOrWhiteSpace($TempRoot)) {
    $TempRoot = [System.IO.Path]::GetTempPath()
}
if ([string]::IsNullOrWhiteSpace($OutputZip)) {
    $OutputZip = Join-Path $TempRoot "cwscx-release.zip"
}

$StageRoot = Join-Path $TempRoot "cwscx-release-stage"
$ReleaseRoot = Join-Path $StageRoot "release"

if (Test-Path $StageRoot) { Remove-Item $StageRoot -Recurse -Force }
if (Test-Path $OutputZip) { Remove-Item $OutputZip -Force }

New-Item -ItemType Directory -Path $ReleaseRoot | Out-Null

Write-Host "Stopping running Node processes to avoid EPERM locks..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "Building frontend artifacts..." -ForegroundColor Cyan

if ($BuildDashboard) {
    Build-Frontend -AppPath (Join-Path $RepoRoot "frontend" "dashboard-blueprint") -BasePath "/dashboard/"
}

if ($BuildSurveys) {
    Build-Frontend -AppPath (Join-Path $RepoRoot "frontend" "survey") -BasePath "/surveys/b2b/"
    New-Item -ItemType Directory -Force -Path (Join-Path $ReleaseRoot "frontends" "internal-surveys" "b2b") | Out-Null
    Copy-Item (Join-Path $RepoRoot "frontend" "survey" "dist") (Join-Path $ReleaseRoot "frontends" "internal-surveys" "b2b" "dist") -Recurse -Force

    Build-Frontend -AppPath (Join-Path $RepoRoot "frontend" "survey") -BasePath "/surveys/installation/"
    New-Item -ItemType Directory -Force -Path (Join-Path $ReleaseRoot "frontends" "internal-surveys" "installation") | Out-Null
    Copy-Item (Join-Path $RepoRoot "frontend" "survey" "dist") (Join-Path $ReleaseRoot "frontends" "internal-surveys" "installation" "dist") -Recurse -Force
}

Write-Host "Collecting backend and deployment files..." -ForegroundColor Cyan
if ($BuildBackend) {
    Copy-BackendRelease -RepoRoot $RepoRoot -ReleaseRoot $ReleaseRoot
}

if ($BuildMysteryShopper) {
    Build-Frontend -AppPath (Join-Path $RepoRoot "frontend" "mystery-shopper") -BasePath "/"
    New-Item -ItemType Directory -Force -Path (Join-Path $ReleaseRoot "frontends" "public" "mystery-shopper") | Out-Null
    Copy-Item (Join-Path $RepoRoot "frontend" "mystery-shopper" "dist") (Join-Path $ReleaseRoot "frontends" "public" "mystery-shopper" "dist") -Recurse -Force
}

if ($BuildDashboard) {
    New-Item -ItemType Directory -Force -Path (Join-Path $ReleaseRoot "frontends" "dashboard") | Out-Null
    Copy-Item (Join-Path $RepoRoot "frontend" "dashboard-blueprint" "dist") (Join-Path $ReleaseRoot "frontends" "dashboard" "dist") -Recurse -Force
}

Copy-Item (Join-Path $RepoRoot "scripts\linux") (Join-Path $ReleaseRoot "scripts\linux") -Recurse -Force
Copy-Item (Join-Path $RepoRoot ".env.example") (Join-Path $ReleaseRoot ".env.example") -Force

Write-Host "Cleaning non-release backend cache files..." -ForegroundColor Cyan
Get-ChildItem (Join-Path $ReleaseRoot "backend") -Directory -Recurse |
    Where-Object { $_.Name -in @("__pycache__", ".pytest_cache") } |
    Remove-Item -Recurse -Force

Get-ChildItem (Join-Path $ReleaseRoot "backend") -File -Recurse |
    Where-Object { $_.Extension -in @(".pyc", ".pyo") } |
    Remove-Item -Force

Push-Location $StageRoot
try {
    # Important: create a zip that contains a top-level 'release/' directory.
    # This is required for compatibility with VM installers that expect 'release/' at the bundle root.
    Compress-Archive -Path "release" -DestinationPath $OutputZip -Force
}
finally {
    Pop-Location
}

Write-Host "Release bundle created: $OutputZip" -ForegroundColor Green
