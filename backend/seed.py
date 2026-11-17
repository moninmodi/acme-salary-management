"""Create 10,000 deterministic fictional employees for the local demo."""
from __future__ import annotations

import argparse
import random
from datetime import datetime, timezone

from backend.db import connect, initialize

FIRST_NAMES = [
    "Avery", "Jordan", "Morgan", "Taylor", "Riley", "Casey", "Jamie", "Quinn", "Alex", "Sam",
    "Priya", "Arjun", "Maya", "Noah", "Emma", "Liam", "Zoe", "Leo", "Nina", "Omar",
]
LAST_NAMES = [
    "Shah", "Patel", "Kim", "Garcia", "Smith", "Chen", "Khan", "Singh", "Brown", "Wilson",
    "Miller", "Davis", "Andersson", "Martin", "Taylor", "Costa", "Okafor", "Roy", "Lopez", "Wong",
]
LOCATIONS = [
    ("India", "INR", 70_000_000, 450_000_000),
    ("United States", "USD", 5_000_000, 18_000_000),
    ("United Kingdom", "GBP", 3_000_000, 11_000_000),
    ("Germany", "EUR", 3_500_000, 12_000_000),
    ("Canada", "CAD", 4_000_000, 14_000_000),
    ("Singapore", "SGD", 4_500_000, 16_000_000),
]
DEPARTMENTS = [
    "Engineering", "Product", "Design", "People", "Finance", "Sales", "Marketing", "Operations",
    "Security", "Support",
]
TITLES = [
    "Software Engineer", "Senior Software Engineer", "Staff Engineer", "Product Manager",
    "Product Designer", "People Partner", "Financial Analyst", "Account Executive", "Data Analyst",
    "Engineering Manager", "Recruiter", "Support Specialist",
]


def seed(count: int = 10_000, force: bool = False) -> int:
    """Create ``count`` reproducible employees and initial salary records."""
    if count < 1:
        raise ValueError("count must be positive")
    initialize()
    rng = random.Random(20261118)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with connect() as db:
        existing = db.execute("SELECT COUNT(*) AS total FROM employees").fetchone()["total"]
        if existing and not force:
            return existing
        if force:
            db.execute("DELETE FROM salary_records")
            db.execute("DELETE FROM employees")
        rows = []
        salaries = []
        for n in range(1, count + 1):
            first = rng.choice(FIRST_NAMES)
            last = rng.choice(LAST_NAMES)
            country, currency, floor, ceiling = rng.choice(LOCATIONS)
            salary = rng.randrange(floor // 10_000, ceiling // 10_000) * 10_000
            rows.append((
                n, f"AC-{n:05d}", first, last, f"employee{n:05d}@acme.example", country,
                rng.choice(DEPARTMENTS), rng.choice(TITLES), "Active" if rng.random() < 0.9 else "Inactive", now,
            ))
            salaries.append((n, None, None, salary, currency, "2025-01-01", "Initial salary record", "System", now))
        db.executemany(
            """INSERT INTO employees
            (id, employee_code, first_name, last_name, email, country, department, job_title,
             employment_status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            rows,
        )
        db.executemany(
            """INSERT INTO salary_records
            (employee_id, previous_salary_minor, previous_currency, new_salary_minor, currency,
             effective_date, reason, changed_by, changed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            salaries,
        )
        return len(rows)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the salary demo with fictional employees")
    parser.add_argument("--force", action="store_true", help="replace existing employees and salary history")
    parser.add_argument("--count", type=int, default=10_000, help="number of employees to generate (default: 10000)")
    args = parser.parse_args()
    total = seed(count=args.count, force=args.force)
    print(f"Database ready with {total:,} employees")
