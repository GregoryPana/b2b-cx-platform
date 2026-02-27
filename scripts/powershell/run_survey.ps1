param(
    [int]$Port = 5173
)

$ErrorActionPreference = "Stop"

$root = Join-Path $PSScriptRoot "..\.."
Push-Location (Join-Path $root "frontend\survey")

if (-not (Test-Path "node_modules")) {
    npm install
}

npm run dev -- --host 0.0.0.0 --port $Port --strictPort

Pop-Location
