$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot/../.."
$Dashboard = Join-Path $Root "frontend/dashboard"

Write-Host "Starting dashboard frontend on port 5175..."
Set-Location $Dashboard
npm run dev -- --host --port 5175
