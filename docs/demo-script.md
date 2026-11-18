# Demo script (about 5 minutes)

Before recording: run `docker compose up --build`, put `GEMINI_API_KEY` in `.env` (then `docker compose up -d api`), and open http://localhost:8080. Use a 1440×900 browser window.

## 1. The problem and the scope (30 s)
- "ACME's HR manager runs salaries for 10,000 people in 6 countries from spreadsheets. This replaces that with one place to manage pay and answer *how do we pay people?*"
- Show `docs/requirements.md` briefly: the goal, and the **deliberately out of scope** list (payroll, FX conversion, auth/SSO), with the reasons.

## 2. Pay overview: answering how ACME pays (90 s)
1. KPI row: 10,000 employees, 6 countries, 10 departments, 6 currencies.
2. **Pay by group → Department** (INR selected by default because it's the largest population). Engineering pays most, Support least. Switch to **Designation**: Engineering Manager and Staff Engineer are at the top.
3. Switch the currency to **USD**: the same structure appears in the US market. Point out that salaries are never added across currencies.
4. Click **Germany** in "Employees by country": the whole page filters, and the URL changes, so the view can be shared.
5. **Unusual salaries**: 1.5×IQR outlier counts per currency.

## 3. Ask a question with Gemini (60 s)
1. Type *"What is the median salary by department in India?"*
2. Show the answer, then the **"How this was answered"** tags (insight, `by department`, `country: India`) and the figures table. "Gemini only picks one of three read-only, validated tools. The numbers come from our tested code, and Gemini never sees employee records."
3. Click the example *"How many salary outliers are there in INR?"*: a different tool (`get_outliers`) is used, and its thresholds are shown.

## 4. Employee directory and a salary change (90 s)
1. **Employees**: search `sharma`, filter Country = India and Department = Engineering. Sort by **Current salary** (only enabled once a country is chosen; the tooltip explains why).
2. Open an employee. Show the profile, current pay and the **salary history timeline** (initial record, merit increases, promotions).
3. Enter a new salary. The **+% vs current** preview appears; type a big number to show the large-change warning.
4. Pick a **future date** with reason "Annual review 2027" and save. It's marked **Scheduled**, and current pay doesn't change.
5. Try saving again on an earlier date: the server rejects it with a clear message (history is append-only).

## 5. Engineering (60 s)
- `docker compose up --build` is the whole setup: MariaDB, FastAPI, nginx and an automatic seed.
- Tests: `python -m unittest discover -s tests -t .` (56 backend tests: unit tests with fakes for the DB and Gemini, plus MariaDB integration tests) and `npm test` (36 UI tests).
- `python scripts/lint_python.py` gives **10.00/10** Pylint with docstrings everywhere. `npm run lint` and `npm run typecheck` are clean.
- `git log --oneline`: incremental commits, including bugs found by tests and end-to-end runs (Decimal serialisation in the Gemini prompt, the lost save confirmation).
- `docs/ai-usage.md`: how AI tools were used, and what was verified by hand.
