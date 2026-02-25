param(
    [ValidateSet("up", "down", "reset")]
    [string]$Action = "up"
)

$root = Join-Path $PSScriptRoot "..\.."
Set-Location $root

if ($Action -eq "up") {
    docker compose -f docker-compose.dev.yml up -d
} elseif ($Action -eq "down") {
    docker compose -f docker-compose.dev.yml down
} elseif ($Action -eq "reset") {
    docker compose -f docker-compose.dev.yml down -v
}
