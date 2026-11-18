# AI-assisted workflow

The brief asked for AI tools to be used deliberately while keeping correctness and quality high. This page records which tools were used for what, the prompts that drove each phase, and how the output was checked. Nothing generated was accepted without running it.

## Tools

| Phase | Tool | Role |
|---|---|---|
| Requirements, first API/UI, first tests (`docs:` and `feat(dashboard):` commits) | **OpenAI Codex** | Turned the brief into the requirements document, then built the MariaDB API, React UI and integration tests in phases (PR #1 and PR #2). |
| Review, hardening, completion (commits after the `feature/dashboard` merge) | **Claude** (Anthropic), agentic coding in a sandbox with Docker | Reviewed the existing code against the brief and the chosen stack, fixed defects, added the missing pieces, and verified everything end to end. |
| Natural-language questions in the product | **Gemini** (`gemini-3.8-flash`, function calling) | Runtime feature: chooses one allowlisted insight and phrases the verified result. |

## Prompts that drove the work

Paraphrased where long; the intent is unchanged.

1. **Brief.** The full assessment text: salary management for 10,000 employees, HR Manager persona, a one-page requirements document first, FastAPI + relational DB + React, seed script, tests, incremental commits and artifacts.
2. **Stack.** *"React, Ant Design, FastAPI, Docker and MariaDB."*
3. **Clarifying the requirement.** *"What does 'answer questions about how the org pays people' mean and what should be delivered?"*, then *"How can question answering be implemented?"* The answer compared three options (keyword rules, LLM function calling over tested insights, and text-to-SQL) and recommended function calling. Text-to-SQL was rejected because it can silently mix currencies or run unsafe queries. The requirements document records the same decision.
4. **Quality bar.** *"Follow best coding practice: Pylint score, docstrings."* This became an enforced `fail-under=10.0`, plus strict TypeScript and ESLint with zero warnings on the frontend.
5. **Completion.** *"Use Gemini for AI; continue and finish all remaining work; don't push, keep changes local; I want the complete application ready."*

## How AI output was verified

- **Run, don't trust.** Every change was followed by the backend unit and integration suites (real MariaDB in Docker), Pylint, `tsc`, ESLint, Vitest and a production build.
- **Browser end-to-end checks.** Playwright drove the real Docker stack: overview, filters, directory, drawer, and saving a salary record. Screenshots were reviewed for layout problems.
- **SDK contract check.** The Gemini tool declarations were validated against `google-genai`'s own `GenerateContentConfig` model, in a unit test, so a schema mistake fails the test suite rather than the demo.
- **Hand-checkable tests.** Statistics tests use tiny cohorts whose quartiles, fences and medians can be worked out on paper.

## Defects found this way (and fixed in separate commits)

| Defect | How it was found | Commit |
|---|---|---|
| Any Gemini question crashed: MariaDB returned `SUM`/`AVG` as `Decimal`, which `json.dumps` can't serialise when building the phrasing prompt | Existing integration test, run against real MariaDB | `fix(api): make salary aggregates JSON-safe…` |
| Summary rows leaked `"department": null` into country rows (one schema for both) | Existing integration test | same |
| Seeded salaries were uniform random per country, so every department had the same average pay and the reports answered nothing | Review of insight output against the brief | `feat(seed): realistic pay model…` |
| The salary form never showed its "saved" confirmation: refetching the employee reset the mutation before its `onSuccess` ran | Playwright run against the Docker stack | `fix(ui): show salary save confirmation reliably` |
| An unhandled promise rejection when the server rejected a salary record | Vitest "unhandled error" report | fixed inside the UI rebuild |

## Where human judgement overrode AI suggestions

- **Scope.** Kept the requirements' deliberate exclusions (no FX conversion, no auth, no back-dating) rather than adding features. Each exclusion has a reason in `requirements.md`.
- **Salary sorting.** The AI-generated directory sorted salaries across currencies. It's now enabled only within a single country.
- **Privacy boundary.** Gemini receives the question and aggregate results only. Employee search and employee records stay in the directory, never in the AI path.
