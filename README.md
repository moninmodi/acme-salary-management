# ACME Salary Management

A salary register for an HR manager: browse 10,000 fictional employees, filter and search server-side, compare salary statistics within each currency, record auditable salary changes, and ask supported HR questions in natural language.

## Stack

- React + Vite UI
- Python + FastAPI API
- MariaDB storage, accessed with PyMySQL

The backend separates HTTP routes (`backend/api`), validated schemas (`backend/schemas.py`), salary business rules (`backend/services`), SQL queries (`backend/repositories`), and MariaDB configuration/session setup (`backend/config.py`, `backend/db.py`).

## Run locally

Requirements: Python 3.11+, Node.js 20+, npm, and Docker Compose.

1. Copy `.env.example` to `.env` and adjust local connection settings if needed. Do not commit `.env` or use its demo credentials outside local development.
2. Start the database: `docker compose up -d mariadb`. The local compose service creates `acme_salary` and a separate `acme_salary_test` database.
3. Install Python dependencies: `python -m venv .venv`, activate the environment, then run `python -m pip install -r requirements.txt`.
4. Seed fictional employee records: `python -m backend.seed` (creates 10,000 records by default; `python -m backend.seed --force` recreates them).
5. Start the API: `uvicorn backend.main:app --reload`.
6. In another terminal, install and start the UI: `npm install`, then `npm run dev`. Open the local URL printed by Vite. Vite forwards `/api` requests to FastAPI on port 8000.

To connect to another MariaDB instance, set `SALARY_DB_HOST`, `SALARY_DB_PORT`, `SALARY_DB_USER`, `SALARY_DB_PASSWORD`, and `SALARY_DB_NAME` before starting the API or seed command. Do not use the compose credentials outside a local demo.

## Ask a question

Natural-language questions are optional. Set `GEMINI_API_KEY` in the local `.env` file to enable the Gemini 3 function-calling flow; without a key the UI disables the question input while all other features remain available. Gemini receives the HR question and computed aggregate results only. It cannot access the database or employee-level records, and the backend validates every requested insight before running it. Never commit a real API key.

## Tests

The API tests use `acme_salary_test` by default and clear its application tables before each test. Start the compose database first, then run `python -m unittest discover -s tests -v`. Set `SALARY_TEST_DB_NAME` to another disposable schema if needed. Do not point tests at real employee data.

Install development tools with `python -m pip install -r requirements-dev.txt`. Run `python scripts/lint_python.py` to print the Pylint score and enforce the configured 8.0 minimum.

## Build and API

- UI production build: `npm run build` (output in `dist/`).
- API health endpoint: `GET /api/health`.
- Interactive API schema: `GET /docs`.

The UI and API can be deployed separately by serving `dist/`, configuring the reverse proxy to route `/api` to FastAPI, and setting the `SALARY_DB_*` variables. A production deployment also needs authentication, authorization, managed secrets, TLS, backups, monitoring, and a reviewed employee-data policy; those are deliberately outside this assessment demo.

See [the requirements document](docs/requirements.md) and [architecture and trade-offs](docs/architecture.md).
