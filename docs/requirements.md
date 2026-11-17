# ACME Salary Management System — Requirements

**Version:** 1.1 · **Status:** Implementation baseline · **Primary user:** ACME HR Manager

## 1. Goal

Replace spreadsheet-based salary administration with a web application for managing compensation records for 10,000 employees across countries and answering common questions about employee and salary distribution. The product should make routine HR work faster and less error-prone. All seeded employee information is synthetic.

## 2. Scope and system boundary

The application consists of a React client, a Python FastAPI service, and a MariaDB database. It manages employee directory details, employment status, each employee's current salary record, salary effective dates, and salary history. The HR Manager is the only user role in scope; the app demonstrates one organisation's workflow.

### Employee management

- Browse employee records in a searchable, paginated directory; employment status is `Active` or `Inactive`.
- Search by employee name or employee ID; filter by country, department, designation/job title, and employment status. Filters can be combined.
- View individual employee details, including current salary, currency, effective date, and salary history.

### Salary management

- Create a new salary record for an employee and update compensation by appending a salary record with an effective date. Future-dated records are scheduled and do not replace the current salary before their effective date.
- Keep amount and ISO currency code separate. Preserve prior amounts and effective dates in history.
- Validate non-negative salary amounts, supported precision, required effective date, and required change reason. A successful current-record change and its history entry must be atomic.

### Dashboard and reporting

- Show total employee count and employee distribution by country and department for the selected filters.
- Show salary count, average, minimum, maximum, and compensation distribution grouped by currency. Do not combine currencies without an explicit conversion policy.
- Apply country and department filters to reports; employee search, designation, status, and other active directory filters also constrain applicable summaries.
- Make common HR questions answerable through the dashboard: how many employees are in each country/department, and what are the salary count, total payroll, average, minimum, and maximum for each currency in the selected population?
- Provide a natural-language question box backed by Gemini 3 function calling. Gemini may select only validated, read-only insight functions; the backend computes results and returns aggregate data to Gemini for phrasing. Show the selected insight, applied filters, aggregate result table, and a way to open the same filtered view.
- If no Gemini API key is configured, disable question answering with a clear setup message while keeping the directory, reports, and salary management available.

### Data and quality

- Provide a reproducible seeder for 10,000 realistic but fictional employees across multiple countries, departments, job titles, currencies, and employment statuses.
- Apply search, filtering, sorting, aggregation, and pagination on the server. Default to 25 results per page; cap pages at 100.
- Provide clear loading, empty, success, and error states. Keep API, business logic, and persistence responsibilities separated.
- Include fast, deterministic unit and integration tests for directory queries, reports, salary validation/effective dates, and history preservation.
- Document setup, architecture, assumptions, trade-offs, and a demo path.

## 3. Business and data rules

Each employee has one current active salary record at a time and one employment status (`Active` or `Inactive`). Salary values are stored as integer minor units with an ISO currency code. Every salary record has an effective date; a future record becomes current on that date while the previous record remains in history. Report totals and salary statistics are grouped by currency. All audit timestamps use UTC. Salary change records include old/new amounts and currencies, effective date, reason, actor, and change timestamp.

Salary outliers use the 1.5×IQR rule independently within each currency. The question interface returns aggregate outlier counts and thresholds, not employee identities.

## 4. Deliberately out of scope

Payroll calculations, taxes, salary disbursement, bank/accounting/HR integrations, automated FX conversion, employee self-service, complex approval workflows, and predictive recommendations are excluded. They require rules, data sources, or personas that are not part of this single-organisation HR administration exercise. Authentication and production access controls are also not specified; use synthetic data only until identity, authorization, secrets, privacy, backups, and hosting requirements are agreed.

## 5. Assumptions and constraints

- Employee records are seeded synthetic data; each employee has one current salary record at a time.
- Salary history is retained when a new record is created or made current.
- “Designation” means job title in the data model and UI.
- Currency conversion is unavailable; currency-specific reports are the only valid salary comparison.
- Synthetic data has no city, job-level, or gender fields. City-based, level-based, and gender-pay-gap questions are out of scope.
- Gemini never receives database access, generated SQL, or employee-level results. It can call only allowlisted aggregate insight functions. Employee search stays in the HR directory and does not pass employee records to the model.
- Text-to-SQL is rejected because it can produce invalid or cross-currency calculations. Model-selected tool arguments are validated before the backend runs an insight function.
- Production deployment and a recorded demo are delivery goals. A hosting target and credentials are not yet provided; deployment configuration and a local demo walkthrough will be prepared pending that environment.

## 6. Acceptance criteria

1. A fresh MariaDB setup can seed exactly 10,000 employees and run the API and UI using documented commands.
2. Name/ID search, combined country/department/designation/status filters, sorting, and pagination return the correct result set and matching total without fetching the full directory.
3. Dashboard employee distributions and currency-grouped salary statistics match the selected data; no cross-currency total is presented.
4. A valid salary record with effective date and reason becomes current and is visible in history with its prior values; an invalid request leaves current salary and history unchanged.
5. With a Gemini API key configured, a question can invoke a validated aggregate insight and return an explanation with the applied filters and supporting results. Without a key, the rest of the application remains usable and the question feature explains how to enable itself.
6. Automated tests cover the core requirements, including fake-model function calls and argument validation. The app includes a deployable build and a recorded-demo walkthrough; hosted deployment follows once a target environment is available.
