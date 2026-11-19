"""Database queries and writes for effective-dated salary records."""
from __future__ import annotations

from backend.db import DatabaseSession, connect


def employee_exists(db: DatabaseSession, employee_id: int) -> bool:
    """Check whether an employee exists in the current transaction."""
    return db.execute("SELECT id FROM employees WHERE id = ?", (employee_id,)).fetchone() is not None


def lock_employee(db: DatabaseSession, employee_id: int) -> bool:
    """Serialize salary writers for an employee, including their first salary."""
    return db.execute("SELECT id FROM employees WHERE id = ? FOR UPDATE", (employee_id,)).fetchone() is not None


def latest_salary_record(db: DatabaseSession, employee_id: int) -> dict | None:
    """Return the latest effective or scheduled salary record for an employee."""
    return db.execute("""SELECT new_salary_minor, currency, effective_date FROM salary_records
        WHERE employee_id = ? ORDER BY effective_date DESC LIMIT 1""", (employee_id,)).fetchone()


def insert_salary_record(
    db: DatabaseSession, *, employee_id: int, previous: dict | None,
    salary_minor: int, currency: str, effective_date: str, reason: str, changed_by: str, changed_at: str,
) -> int:
    """Insert one salary version and return its generated record identifier."""
    cursor = db.execute("""INSERT INTO salary_records
        (employee_id, previous_salary_minor, previous_currency, new_salary_minor, currency,
         effective_date, reason, changed_by, changed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""", (
        employee_id,
        previous["new_salary_minor"] if previous else None,
        previous["currency"] if previous else None,
        salary_minor, currency, effective_date, reason, changed_by, changed_at,
    ))
    return cursor.lastrowid


def get_salary_history(employee_id: int) -> list[dict] | None:
    """Return an employee's salary history, or ``None`` if the employee is absent."""
    with connect() as db:
        if not employee_exists(db, employee_id):
            return None
        return db.execute(
            """SELECT id, previous_salary_minor, previous_currency, new_salary_minor,
            currency, effective_date, reason, changed_by, changed_at
            FROM salary_records WHERE employee_id = ? ORDER BY effective_date DESC, id DESC""",
            (employee_id,),
        ).fetchall()
