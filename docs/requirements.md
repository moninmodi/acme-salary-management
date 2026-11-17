# Salary Management System — Software Requirements

**Version:** 1.0 · **Status:** Approved baseline for the assessment build · **Primary user:** ACME HR Manager

## 1. Purpose and scope

Replace spreadsheet-based salary lookup and routine updates with a browser-based salary register for ACME's 10,000 employees across multiple countries. The system helps an HR manager find an employee, understand the distribution of current base salaries, and record a justified salary change. This assessment build is a local demonstration using fictional seeded records; it is not approved for real employee data.

## 2. System boundary

The system consists of a React web client, a Python HTTP API, and a relational database. It owns the employee directory fields, each employee's current base salary and currency, and an append-only salary-change history. The HR manager is the only user role in scope. Payroll execution, identity services, external HR systems, and exchange-rate services are outside the boundary.

## 3. Functional requirements

- **FR-1 Directory:** The user shall view employee name, employee code, email, country, department, job title, salary, and currency.
- **FR-2 Find and filter:** The user shall search by name, employee code, or email and filter by country, department, and job title. Filters may be combined.
- **FR-3 Navigate and sort:** The system shall return a bounded page of results (default 25, maximum 100), report the matching total, and support sorting by name, salary, country, or department.
- **FR-4 Compensation insight:** The system shall show employee count and salary minimum, maximum, and average grouped by currency for the active filters. It shall not combine values from different currencies.
- **FR-5 Change salary:** The user shall set a non-negative salary amount and provide a reason. The system shall reject malformed, unchanged, or out-of-range values with a useful error.
- **FR-6 Audit:** A successful change shall update the current salary and append old amount, new amount, currency, reason, actor, and timestamp atomically. The user shall be able to view an employee's change history. Failed changes shall leave both current salary and history unchanged.
- **FR-7 Seed:** A repeatable command shall initialize the schema and create 10,000 deterministic, fictional employees across multiple countries, departments, titles, and currencies. Re-running without a force option shall not duplicate records.

## 4. Data and business rules

Each employee has one current annual base salary in one ISO 4217 currency. Store amounts as integer minor units; display them as currency amounts. Each employee has a unique employee code and email. Search and filters operate on the server. Summary statistics use the same filters as the directory and group by currency. A salary update and its audit entry form one database transaction. Timestamps use UTC. The demonstration actor defaults to “HR Manager” because authentication is not in scope.

## 5. Quality requirements and constraints

- **Performance:** Directory reads and summaries shall be computed in the database; the client shall never fetch all 10,000 rows for a normal page view.
- **Reliability:** Invalid requests shall not partially update data. Seed and core tests shall be deterministic and easy to run locally.
- **Usability:** The UI shall provide loading, empty, and error states; labeled controls; keyboard-accessible directory rows and salary editing; and clear validation feedback.
- **Maintainability:** Use a small, documented React + Python + relational database architecture with automated tests for search/filtering, pagination/summary, validation, and audit behavior.
- **Security boundary:** No authentication or authorization is implemented. Only fictional data is permitted in this demo; production use requires identity/access control and appropriate privacy/security review.

## 6. Acceptance criteria

1. A fresh setup can seed exactly 10,000 employees and launch the UI and API using documented commands.
2. Search and combined filters return the correct matching page and total; paging and sorting work without transferring the full directory.
3. Summary counts and salary statistics match the selected records and remain separated by currency.
4. A valid salary change appears in the directory and history with its prior value, reason, actor, and timestamp; invalid or unchanged changes do not alter either.
5. Automated tests cover the core behaviors above, and the repository includes setup instructions and design/trade-off notes.

## 7. Explicit exclusions

Payroll, tax, benefits, bonus calculations, and payment execution are excluded because jurisdiction-specific rules and integrations are unspecified. CSV import/export and migration are excluded to keep this build focused on safe record operations. Currency conversion and cross-currency totals are excluded because no rate source or valuation date policy is defined. Authentication, approval workflows, concurrent-edit resolution, hosted deployment, and a recorded demo require product, infrastructure, or identity decisions not provided in the assessment; the build will document the local demo path and deployment configuration needs.
