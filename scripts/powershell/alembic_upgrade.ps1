param(
    [string]$ConfigPath = "backend\alembic.ini",
    [string]$Revision = "head"
)

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$env:PYTHONPATH = "backend"

Push-Location $RepoRoot
try {
    python -m alembic -c $ConfigPath upgrade $Revision
} finally {
    Pop-Location
}
