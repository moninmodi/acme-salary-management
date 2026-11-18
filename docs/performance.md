# Performance notes

The target from the requirements is 10,000 employees and about 35,000 salary records, used by one HR manager. The aim is fast enough to feel instant, with no unnecessary machinery.

## Measured (Docker Compose stack, through nginx, warm)

| Request | Time |
|---|---|
| `GET /api/employees?limit=25` (first page) | ~25 ms |
| `GET /api/employees?search=sharma&sort=salary&direction=desc` | ~40 ms |
| `GET /api/summary` (whole org: 5 aggregates + medians) | ~240 ms |
| `GET /api/summary?country=India` | ~100 ms |
| `GET /api/insights/breakdown?by=designation` | ~160 ms |
| `GET /api/insights/outliers` | ~130 ms |
| `python -m backend.seed --force` (10k employees, ~35.6k salary records) | ~1.1 s |

The backend unit suite takes about 0.6 s and the full backend suite with MariaDB about 2.5 s.

## What keeps it fast

- **Server-side everything.** Search, filters, sorting, paging and aggregation run on the server. The browser never receives more than 100 rows; the default page is 25.
- **Indexes** on every filter column (`country`, `department`, `job_title`, `employment_status`), on `(last_name, first_name)` for the default sort, and on `(employee_id, effective_date)`. The last one makes the "latest effective record" lookup an index seek per employee.
- **Narrow projections for statistics.** Medians and IQR fences need the full distribution, so the service fetches only `(currency, salary, group)`, not employee records, and computes in Python (exact, unit-tested, the same on any SQL engine).
- **Bulk seeding** with `executemany` in a single transaction.
- **UI:** `keepPreviousData` (no empty table between pages), a 300 ms search debounce, cached reference data (`staleTime`), vendor chunks split out (antd and charts are cached separately from app code), gzip, and immutable caching of hashed assets in nginx.

## Known limits and next steps if data grew 50×+

1. **Current-salary join.** It uses a correlated `MAX(effective_date) <= today` subquery. At around 500k employees, keep a `current_salary` table (or a view refreshed nightly and on write) instead.
2. **Percentiles.** Move them to MariaDB window functions or a materialised summary refreshed on write.
3. **`COUNT(*)` for every page.** Cache totals per filter combination for a short time, or switch to keyset pagination.
4. **Free-text search** with `LIKE '%term%'` can't use an index. A MariaDB `FULLTEXT` index or a search service would replace it.
5. **Gemini latency** (two model calls, typically 1–3 s) dominates question answers. A cache keyed on the normalised question and data version would help repeated questions.
