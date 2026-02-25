param(
    [int]$Port = 5174
)

$ErrorActionPreference = "Stop"

$root = Join-Path $PSScriptRoot "..\.."
Push-Location (Join-Path $root "frontend\dashboard")

if (-not (Test-Path "node_modules")) {
    npm install
}

npm run dev -- --port $Port

Pop-Location
