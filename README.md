# ACME Salary Management

A salary register for ACME's HR Manager. It replaces the salary spreadsheets for 10,000 employees in six countries. HR can browse and filter the directory, record auditable salary changes with an effective date, and answer **"how does ACME pay people?"** from a pay dashboard, or by asking a question in plain English, which Gemini answers using verified data.

All employee data is synthetic.

| | |
|---|---|
| **UI** | React 19 · TypeScript · Ant Design 6 · TanStack Query · Recharts (Vite) |
| **API** | Python 3.12 · FastAPI · Pydantic · PyMySQL |
| **Database** | MariaDB 11 (InnoDB) |
| **AI (optional)** | Gemini function calling (`google-genai`), restricted to read-only, validated aggregate insights |
| **Runtime** | Docker Compose: `mariadb` → `api` → `web` (nginx serving the build and proxying `/api`) |

## Quick start (Docker, one command)

```bash
cp .env.example .env          # optional: add GEMINI_API_KEY to enable "Ask about compensation"
docker compose up --build     # (or: make up) first run seeds 10,000 employees (~2 s)
open http://localhost:8080
```

Stop with `docker compose down`. Add `-v` to also delete the database volume and re-seed on the next start.

## What the HR Manager can do

- **Pay overview** (`/overview`)
  - Ask a question in plain English. The answer shows which insight, filters and figures produced it.
  - See headcount KPIs.
  - Compare median, average and range of pay by department, designation, country or status, one currency at a time.
  - See payroll per currency.
  - Click a country or department to drill into it.
  - See 1.5×IQR salary outlier counts.
- **Employees** (`/employees`)
  - Server-side paginated directory of 10,000 people.
  - Debounced search by name, email or ID, plus combined filters.
  - Sort by name, country or department. Salary sorting is enabled once a country is selected, because amounts in different currencies aren't comparable.
- **Employee drawer**
  - Profile and current pay.
  - New salary record: an amount, a currency, a reason (required) and an effective date. A record dated today becomes current immediately; a future date schedules it.
  - The form shows the percentage change live and warns on large changes.
  - The full history is shown as a timeline of current, past and scheduled records.
- Filters, sorting, paging and the open employee are all kept in the URL, so any view can be bookmarked or shared.

## Local development (without Docker for the app)

Requirements: Python 3.11+, Node 20+, Docker (for MariaDB).

```bash
cp .env.example .env
docker compose up -d mariadb                       # also creates the acme_salary_test schema
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
python -m backend.seed                             # --force to re-create, --count N to change size
uvicorn backend.main:app --reload                  # http://localhost:8000/docs
npm install && npm run dev                         # http://localhost:5173 (proxies /api to :8000)
```

## Quality checks

| Check | Command | Status |
|---|---|---|
| Backend unit tests (no DB, no network) | `python -m unittest discover -s tests/unit -t .` | 40 tests, ~0.6 s |
| Backend integration tests (MariaDB) | `python -m unittest discover -s tests -t .` | 56 tests in total; skipped with a message if MariaDB is down |
| Pylint (docstrings and style), fails below 10.00 | `python scripts/lint_python.py` | **10.00/10** |
| Frontend tests (Vitest + Testing Library) | `npm test` | 36 tests |
| TypeScript (strict) | `npm run typecheck` | clean |
| ESLint (typescript-eslint, react-hooks) | `npm run lint` | 0 warnings |
| Production build | `npm run build` | ok |

Integration tests use the disposable `acme_salary_test` schema (override with `SALARY_TEST_DB_NAME`) and wipe its tables before each test. Never point them at real data.

## Ask a question (Gemini)

Set `GEMINI_API_KEY` in `.env` and restart the API (`docker compose up -d api`). The default model is `gemini-3.8-flash`; change it with `GEMINI_MODEL`.

1. Gemini receives the question and must call exactly one of three tools: `get_summary`, `get_breakdown` or `get_outliers`. Automatic execution is disabled.
2. The backend validates the tool name and arguments with Pydantic, and checks filter values against the real directory, before running the tested insight function.
3. Gemini then phrases an answer from that aggregate result only. It never receives SQL, database access or employee-level records.
4. The UI shows the answer next to the insight, filters and figures behind it, so HR can verify it.

Without a key the panel explains how to enable it, and everything else keeps working.

## API

Interactive docs are at `/docs` (`http://localhost:8000/docs` in local development). Main endpoints:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/employees` | Search, filter, sort and page the directory (≤100 per page) |
| GET | `/api/employees/{id}` · `/history` | Employee with current pay · salary history |
| POST | `/api/employees/{id}/salaries` | Append a current or scheduled salary record |
| GET | `/api/summary` | Headcount distributions and per-currency salary statistics |
| GET | `/api/insights/breakdown?by=` | Pay statistics by department, designation, country, status or currency |
| GET | `/api/insights/outliers` | 1.5×IQR outlier counts per currency |
| GET | `/api/options` · `/api/features` | Filter values · whether Gemini is enabled |
| POST | `/api/questions` | Natural-language question to a verified insight |

## Project layout

```
backend/            FastAPI app: api/ (HTTP) → services/ (rules) → repositories/ (SQL) → db.py
  seed.py           deterministic generator (pure) + idempotent loader
tests/unit/         fast tests with fakes for the DB and Gemini
tests/integration/  API tests against the MariaDB test schema
src/                React + TypeScript UI: api/ (typed client, query hooks), pages/, components/, lib/
docker/             Dockerfiles, nginx config, API entrypoint
docs/               requirements, architecture, AI usage, performance, demo script
```

## Documentation

- [Requirements](docs/requirements.md): goal, scope, what's deliberately left out and why
- [Architecture and trade-offs](docs/architecture.md)
- [AI-assisted workflow and prompts](docs/ai-usage.md)
- [Performance notes](docs/performance.md)
- [Demo script](docs/demo-script.md): a walkthrough for the recorded video

## Production notes

This is an assessment demo. A real deployment would also need SSO/RBAC, managed secrets, TLS, backups, monitoring, audit-log retention and an agreed employee-data policy. These are listed as out of scope in the requirements.
