$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot/../.."
$Survey = Join-Path $Root "frontend/survey"

Write-Host "Starting survey frontend on port 5176..."
Set-Location $Survey
npm run dev -- --host --port 5176
