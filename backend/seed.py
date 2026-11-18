"""Create 10,000 deterministic fictional employees with realistic pay and salary history.

The generator is pure (``generate``) so it can be unit-tested without a database; ``seed``
writes its output to MariaDB in one transaction.

Pay model (annual base, local currency, stored as integer minor units)::

    designation base (USD reference) x country market factor x lognormal noise (sigma 0.10)
    converted to local currency with a fixed seed-only rate and rounded to a sensible step

The conversion rates exist only to produce plausible local numbers. The application itself
never converts currencies (see docs/requirements.md).
"""
from __future__ import annotations

import argparse
import random
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone

from backend.db import connect, initialize

SEED = 20261118
EARLIEST_HIRE = date(2016, 1, 1)
REVIEW_MONTH_DAY = (4, 1)  # annual compensation review on 1 April
MAX_REVIEWS = 4
INACTIVE_SHARE = 0.10
SCHEDULED_RAISE_SHARE = 0.03


@dataclass(frozen=True)
class Country:
    """Seed-only description of one country's labour market."""

    name: str
    currency: str
    headcount_share: float
    market_factor: float  # pay level relative to the US for the same role
    local_per_usd: float  # seed-only reference rate, never used by the app
    rounding_minor: int  # salaries are rounded to this many minor units
    first_names: tuple[str, ...]
    last_names: tuple[str, ...]


COUNTRIES = (
    Country("India", "INR", 0.32, 0.30, 83.0, 1_000_000,
            ("Priya", "Arjun", "Ananya", "Rohan", "Kavya", "Vikram", "Neha", "Aditya", "Meera", "Karan"),
            ("Sharma", "Patel", "Iyer", "Reddy", "Nair", "Singh", "Gupta", "Mehta", "Rao", "Kulkarni")),
    Country("United States", "USD", 0.30, 1.00, 1.0, 100_000,
            ("Avery", "Jordan", "Emily", "Michael", "Olivia", "Ethan", "Grace", "Daniel", "Hannah", "Ryan"),
            ("Smith", "Johnson", "Brown", "Miller", "Davis", "Garcia", "Wilson", "Moore", "Clark", "Lopez")),
    Country("United Kingdom", "GBP", 0.12, 0.70, 0.79, 50_000,
            ("Amelia", "Oliver", "Isla", "Harry", "Freya", "George", "Poppy", "Jack", "Alice", "Thomas"),
            ("Taylor", "Evans", "Roberts", "Walker", "Wright", "Hughes", "Green", "Hall", "Wood", "Turner")),
    Country("Germany", "EUR", 0.10, 0.75, 0.92, 50_000,
            ("Anna", "Lukas", "Lena", "Felix", "Laura", "Jonas", "Marie", "Paul", "Sophie", "Moritz"),
            ("Mueller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Koch", "Wolf")),
    Country("Canada", "CAD", 0.09, 0.78, 1.36, 50_000,
            ("Liam", "Emma", "Noah", "Chloe", "Logan", "Maya", "Owen", "Claire", "Nathan", "Zoe"),
            ("Tremblay", "Gagnon", "Roy", "Bouchard", "Morin", "Fortin", "Campbell", "Stewart", "Fraser", "Lee")),
    Country("Singapore", "SGD", 0.07, 0.85, 1.34, 50_000,
            ("Wei Jie", "Hui Min", "Jun Hao", "Mei Ling", "Marcus", "Siti", "Ryan", "Jia Hui", "Arif", "Xin Yi"),
            ("Tan", "Lim", "Ng", "Ong", "Wong", "Goh", "Chua", "Koh", "Teo", "Yeo")),
)

# department -> (headcount share, designations with a US reference base salary in USD)
DEPARTMENTS: dict[str, tuple[float, tuple[tuple[str, int], ...]]] = {
    "Engineering": (0.34, (("Software Engineer", 120_000), ("Senior Software Engineer", 155_000),
                           ("Staff Engineer", 195_000), ("Engineering Manager", 210_000))),
    "Product": (0.06, (("Product Manager", 150_000),)),
    "Design": (0.05, (("Product Designer", 125_000),)),
    "Security": (0.04, (("Security Engineer", 150_000),)),
    "Sales": (0.14, (("Account Executive", 100_000), ("Sales Development Rep", 70_000))),
    "Marketing": (0.06, (("Marketing Manager", 110_000),)),
    "Support": (0.13, (("Support Specialist", 60_000),)),
    "Operations": (0.08, (("Data Analyst", 100_000), ("Operations Analyst", 85_000))),
    "Finance": (0.05, (("Financial Analyst", 95_000),)),
    "People": (0.05, (("People Partner", 105_000), ("Recruiter", 85_000))),
}

RAISES = (  # reason, probability, (min, max) increase
    ("Annual merit increase", 0.70, (0.02, 0.06)),
    ("Promotion", 0.18, (0.08, 0.15)),
    ("Market adjustment", 0.12, (0.03, 0.08)),
)


@dataclass
class SeedData:
    """Rows ready for bulk insertion, in column order."""

    employees: list[tuple]
    salary_records: list[tuple]


def _round_minor(amount_major: float, step_minor: int) -> int:
    """Convert a major-unit amount to minor units rounded to a whole ``step_minor``."""
    return max(step_minor, round(amount_major * 100 / step_minor) * step_minor)


def _review_date(year: int) -> date:
    """Return the annual review date for ``year``."""
    return date(year, *REVIEW_MONTH_DAY)


def _timestamp(day: date) -> str:
    """Return an ISO-8601 UTC audit timestamp at 09:00 on ``day``."""
    return datetime.combine(day, time(9, 0), tzinfo=timezone.utc).isoformat(timespec="seconds")


def _salary_history(
    rng: random.Random, current_minor: int, hire_date: date, today: date, step_minor: int,
) -> list[tuple[date, int, str]]:
    """Build (effective date, salary, reason) rows ending exactly at ``current_minor``.

    Works backwards from today's salary so the latest effective record always equals the
    salary the pay model intended. Effective dates are unique per employee.
    """
    review_years = [
        year for year in range(hire_date.year + 1, today.year + 1) if _review_date(year) <= today
    ][-MAX_REVIEWS:]
    review_years = [year for year in review_years if rng.random() < 0.8]
    changes = []
    for year in review_years:
        reason, _, (low, high) = rng.choices(RAISES, weights=[r[1] for r in RAISES])[0]
        changes.append((_review_date(year), reason, 1 + rng.uniform(low, high)))

    amounts = [current_minor]
    for _, _, factor in reversed(changes):
        amounts.insert(0, max(step_minor, round(amounts[0] / factor / step_minor) * step_minor))

    history = [(hire_date, amounts[0], "Initial salary record")]
    for (effective, reason, _), amount in zip(changes, amounts[1:], strict=True):
        if amount != history[-1][1]:  # rounding can swallow a tiny raise; skip no-op records
            history.append((effective, amount, reason))
    return history


def generate(count: int = 10_000, today: date | None = None, seed_value: int = SEED) -> SeedData:
    """Generate ``count`` fictional employees and their salary records deterministically."""
    if count < 1:
        raise ValueError("count must be positive")
    today = today or datetime.now(timezone.utc).date()
    rng = random.Random(seed_value)
    created_at = _timestamp(today)
    department_names = list(DEPARTMENTS)
    department_weights = [DEPARTMENTS[name][0] for name in department_names]
    country_weights = [country.headcount_share for country in COUNTRIES]
    latest_hire = today - timedelta(days=30)

    employees: list[tuple] = []
    salary_records: list[tuple] = []
    for n in range(1, count + 1):
        country = rng.choices(COUNTRIES, weights=country_weights)[0]
        department = rng.choices(department_names, weights=department_weights)[0]
        job_title, base_usd = rng.choice(DEPARTMENTS[department][1])
        first, last = rng.choice(country.first_names), rng.choice(country.last_names)
        status = "Inactive" if rng.random() < INACTIVE_SHARE else "Active"
        hire_date = EARLIEST_HIRE + timedelta(days=rng.randrange((latest_hire - EARLIEST_HIRE).days))

        annual_local = base_usd * country.market_factor * rng.lognormvariate(0, 0.10) * country.local_per_usd
        current_minor = _round_minor(annual_local, country.rounding_minor)

        employees.append((
            n, f"AC-{n:05d}", first, last, f"employee{n:05d}@acme.example", country.name,
            department, job_title, status, created_at,
        ))
        previous: tuple[int, str] | None = None
        for effective, amount, reason in _salary_history(rng, current_minor, hire_date, today,
                                                         country.rounding_minor):
            salary_records.append((
                n, previous[0] if previous else None, previous[1] if previous else None,
                amount, country.currency, effective.isoformat(), reason,
                "System" if previous is None else "HR Manager", _timestamp(effective),
            ))
            previous = (amount, country.currency)

        if status == "Active" and rng.random() < SCHEDULED_RAISE_SHARE:
            effective = today + timedelta(days=rng.randint(14, 120))
            raised = _round_minor(previous[0] / 100 * rng.uniform(1.03, 1.08), country.rounding_minor)
            salary_records.append((
                n, previous[0], previous[1], raised, country.currency, effective.isoformat(),
                "Scheduled annual review", "HR Manager", created_at,
            ))
    return SeedData(employees=employees, salary_records=salary_records)


def seed(count: int = 10_000, force: bool = False) -> int:
    """Write ``count`` generated employees and their salary history; idempotent unless ``force``."""
    if count < 1:
        raise ValueError("count must be positive")
    initialize()
    with connect() as db:
        existing = db.execute("SELECT COUNT(*) AS total FROM employees").fetchone()["total"]
        if existing and not force:
            return existing
        if force:
            db.execute("DELETE FROM salary_records")
            db.execute("DELETE FROM employees")
        data = generate(count)
        db.executemany(
            """INSERT INTO employees
            (id, employee_code, first_name, last_name, email, country, department, job_title,
             employment_status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            data.employees,
        )
        db.executemany(
            """INSERT INTO salary_records
            (employee_id, previous_salary_minor, previous_currency, new_salary_minor, currency,
             effective_date, reason, changed_by, changed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            data.salary_records,
        )
        return len(data.employees)


def main() -> None:
    """Parse command-line options and seed the configured database."""
    parser = argparse.ArgumentParser(description="Seed the salary demo with fictional employees")
    parser.add_argument("--force", action="store_true", help="replace existing employees and salary history")
    parser.add_argument("--count", type=int, default=10_000, help="number of employees to generate (default: 10000)")
    args = parser.parse_args()
    total = seed(count=args.count, force=args.force)
    print(f"Database ready with {total:,} employees")


if __name__ == "__main__":
    main()
