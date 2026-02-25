.PHONY: dev-db-up dev-db-down dev-db-reset backend-install backend-test backend-run alembic-upgrade alembic-downgrade alembic-revision

dev-db-up:
	docker compose -f docker-compose.dev.yml up -d

dev-db-down:
	docker compose -f docker-compose.dev.yml down

dev-db-reset:
	docker compose -f docker-compose.dev.yml down -v

backend-install:
	pip install -r backend/requirements.txt

backend-test:
	PYTHONPATH=backend pytest backend/tests

backend-run:
	PYTHONPATH=backend uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

alembic-upgrade:
	PYTHONPATH=backend alembic -c backend/alembic.ini upgrade head

alembic-downgrade:
	PYTHONPATH=backend alembic -c backend/alembic.ini downgrade -1

alembic-revision:
	PYTHONPATH=backend alembic -c backend/alembic.ini revision --autogenerate -m "$(MSG)"
