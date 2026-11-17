# Salary Management — Requirements

## Goal

Give ACME's HR manager one dependable place to maintain salary records for 10,000 employees across countries and answer common questions about compensation. The first release should make routine salary review and updates faster than working across spreadsheets while keeping changes traceable.

## User and primary workflows

The primary user is an authenticated HR manager. They can:

1. Browse, search, sort, and paginate employee salary records.
2. Filter by country, department, and job title, and inspect useful summary counts and salary statistics for the current view.
3. Open an employee record and update salary details with validation.
4. See a salary change history with who/when/reason information so edits are auditable.

## Scope and features

- A responsive React web UI backed by a Python API and relational database.
- A reproducible seed command that creates 10,000 realistic, fictional employee records spanning multiple countries, currencies, departments, and roles.
- Server-side filtering, sorting, aggregation, and pagination; the browser must not load all 10,000 rows at once.
- Salary edits validated at the API boundary, with a required reason and an audit entry recorded in the same database transaction.
- Clear loading, empty, validation, and failure states, plus accessible labels and keyboard-operable controls.
- Automated tests for core API behavior, validation, audit history, filtering, and aggregation.
- Setup, seed, test, and run instructions, with a short architecture and trade-off note.

## Deliberately out of scope for this release

- **Payroll calculation, tax, benefits, bonuses, and payment execution:** these require jurisdiction-specific rules and integrations beyond a salary register.
- **Authentication, authorization, and production identity integration:** the assessment has one HR persona and no identity-provider requirements. The app is a local demo and must not be presented as production-ready for sensitive real employee data.
- **Bulk import/export and spreadsheet migration:** useful follow-up work, but it adds file validation and reconciliation concerns that would distract from proving the core record-management workflow.
- **Multi-currency conversion or a global salary benchmark:** preserve each record's currency and compare/aggregate salaries only within a single currency. No FX source or conversion date policy is specified.
- **Multi-user conflict resolution and approval workflows:** a single HR manager is the stated persona; optimistic concurrency and approvals can be added when business rules are known.
- **Deployment and hosted video demo:** the brief asks for these deliverables, but no hosting account or deployment target is provided. Keep the app deployable with documented configuration; provide a local demo path and deployment instructions where feasible.

## Product and engineering decisions

- Store salary amounts as integer minor units (for example, cents) and store an ISO currency code with each employee. This avoids floating-point rounding and prevents misleading cross-currency totals.
- Keep employee identity and current compensation in a normalized relational schema, with append-only salary history for auditability.
- Use deterministic seeded data so screenshots and tests are repeatable.
- Enforce filtering, pagination, and aggregates in the API/database to keep response sizes and query work bounded as the employee count grows.
- Prefer a small, understandable architecture over distributed services for a 10,000-record assessment application.

## Open assumptions

- Each employee has one current base salary and one currency at a time.
- Salary history is retained indefinitely in the demo.
- Country, department, and job title are descriptive fields, not access-control boundaries.
- Production use would require authentication, authorization, secure hosting, backups, retention policy, and review of applicable privacy and employment requirements.
