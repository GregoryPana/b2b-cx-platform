@echo off
setlocal

set "ROOT=%~dp0..\.."

echo Starting PostgreSQL via Docker Compose...
cd /d "%ROOT%"
docker compose -f docker-compose.dev.yml up -d

echo Done. PostgreSQL should be available on localhost:5432

endlocal
