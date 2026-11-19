# ACME salary register

**User and goal.** ACME’s HR manager maintains salaries for 10,000 employees across several countries in spreadsheets. The manager needs to answer “How do we pay people in this group?” and record a pay change without losing the previous amount or when it applied.

**Find the right population.** Search the directory by name or employee ID. Combine country, department, job title and employment status filters. Show the matching headcount, employee distribution and a paginated directory. An HR manager should be able to go from a country-level payroll question to an individual record in the same session.

**Understand compensation.** Display current annual base pay, payroll, average and range separately for each currency. Each figure must use the same filters as the directory. An optional natural-language interface can select validated aggregate queries and show their supporting figures. The dashboard must answer the core questions without a model key.

**Record a change.** Capture amount, currency, effective date and reason. A raise effective today updates the employee and reports immediately. A future raise appears as scheduled while the existing salary stays current. Preserve previous amounts and dates. Reject an invalid change without altering history, and serialize concurrent edits for the same employee.

**Delivery and acceptance.** Seed 10,000 fictional employees reproducibly. Verify combined filters, per-currency reports, validation, effective dates, history and repeatable seeding with automated tests. A reviewer should be able to open the app, select a country, schedule a raise, and confirm its effect in history. Supply a recorded walkthrough and setup instructions.

**Scope decisions.** Payroll processing, taxes, bonuses and benefits require country-specific policies beyond annual base pay. Currency conversion needs an agreed FX rate and valuation date. Imports, employee self-service and approvals introduce separate workflows and users. This assessment uses synthetic records and a single HR persona. Real employee data would require authentication, access controls and a retention policy.
