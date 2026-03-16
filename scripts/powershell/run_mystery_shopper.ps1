$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot/../.."
$MysteryShopper = Join-Path $Root "frontend/mystery-shopper"

Write-Host "Starting Mystery Shopper frontend on port 5177..."
Set-Location $MysteryShopper
npm run dev -- --host --port 5177
