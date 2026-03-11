$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot/../.."

Write-Host "Starting PostgreSQL via Docker Compose..."
Set-Location $Root
docker compose -f docker-compose.dev.yml up -d
Write-Host "Done. PostgreSQL should be available on localhost:5432"
