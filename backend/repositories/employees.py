"""Database queries for employee-directory and dashboard data."""
from __future__ import annotations

from backend.db import connect


def _where_clause(
    search: str,
    country: str,
    department: str,
    job_title: str,
    employment_status: str,
    currency: str = "",
) -> tuple[str, list[str]]:
    """Build a safe SQL filter from directory fields and parameter values."""
    clauses: list[str] = []
    values: list[str] = []
    if search:
        clauses.append("(CONCAT(e.first_name, ' ', e.last_name) LIKE ? OR e.employee_code LIKE ? OR e.email LIKE ?)")
        values.extend([f"%{search}%"] * 3)
    filters = (
        ("country", country),
        ("department", department),
        ("job_title", job_title),
        ("employment_status", employment_status),
        ("current_salary.currency", currency),
    )
    for column, value in filters:
        if value:
            qualified_column = column if "." in column else f"e.{column}"
            clauses.append(f"{qualified_column} = ?")
            values.append(value)
    return (" WHERE " + " AND ".join(clauses) if clauses else "", values)


def _current_salary_join(as_of: str) -> tuple[str, list[str]]:
    """Join each employee to the latest salary record effective on a date."""
    sql = """LEFT JOIN salary_records AS current_salary
        ON current_salary.employee_id = e.id
        AND current_salary.effective_date = (
            SELECT MAX(scheduled.effective_date) FROM salary_records AS scheduled
            WHERE scheduled.employee_id = e.id AND scheduled.effective_date <= ?
        )"""
    return sql, [as_of]


def get_filter_options() -> dict[str, list[str]]:
    """Return distinct directory values for the UI's filter controls."""
    columns = (
        ("countries", "country"),
        ("departments", "department"),
        ("job_titles", "job_title"),
        ("employment_statuses", "employment_status"),
    )
    with connect() as db:
        options = {
            key: [row[column] for row in db.execute(f"SELECT DISTINCT {column} FROM employees ORDER BY {column}")]
            for key, column in columns
        }
        options["currencies"] = [
            row["currency"]
            for row in db.execute("SELECT DISTINCT currency FROM salary_records ORDER BY currency")
        ]
        return options


def list_employees(
    *, search: str, country: str, department: str, job_title: str, employment_status: str,
    sort: str, direction: str, limit: int, offset: int, as_of: str, currency: str = "",
) -> tuple[list[dict], int]:
    """Fetch one filtered employee page with the salary effective on ``as_of``."""
    where, values = _where_clause(search, country, department, job_title, employment_status, currency)
    sort_columns = {
        "name": "e.last_name, e.first_name",
        "salary": "current_salary.new_salary_minor",
        "country": "e.country, e.last_name",
        "department": "e.department, e.last_name",
    }
    order = ", ".join(f"{column} {direction.upper()}" for column in sort_columns[sort].split(", "))
    salary_join, salary_values = _current_salary_join(as_of)
    with connect() as db:
        total = db.execute(
            f"SELECT COUNT(*) AS total FROM employees AS e {salary_join}{where}",
            [*salary_values, *values],
        ).fetchone()["total"]
        rows = db.execute(
            f"""SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, e.country,
            e.department, e.job_title, e.employment_status, e.created_at,
            current_salary.new_salary_minor AS salary_minor, current_salary.currency,
            current_salary.effective_date AS salary_effective_date
            FROM employees AS e {salary_join}{where}
            ORDER BY {order} LIMIT ? OFFSET ?""",
            [*salary_values, *values, limit, offset],
        ).fetchall()
    return rows, total


def get_dashboard_summary(
    *, search: str, country: str, department: str, job_title: str, employment_status: str,
    as_of: str, currency: str = "",
) -> dict:
    """Aggregate filtered employee distributions and currency-specific salaries."""
    where, values = _where_clause(search, country, department, job_title, employment_status, currency)
    salary_join, salary_values = _current_salary_join(as_of)
    salary_where = (
        where + " AND current_salary.currency IS NOT NULL"
        if where
        else " WHERE current_salary.currency IS NOT NULL"
    )
    with connect() as db:
        total = db.execute(
            f"SELECT COUNT(*) AS total FROM employees AS e {salary_join}{where}",
            [*salary_values, *values],
        ).fetchone()["total"]
        by_country = db.execute(
            "SELECT e.country, COUNT(*) AS employee_count FROM employees AS e " + salary_join + where
            + " GROUP BY e.country ORDER BY e.country",
            [*salary_values, *values],
        ).fetchall()
        by_department = db.execute(
            "SELECT e.department, COUNT(*) AS employee_count FROM employees AS e " + salary_join + where
            + " GROUP BY e.department ORDER BY e.department",
            [*salary_values, *values],
        ).fetchall()
        by_currency = db.execute(
            f"""SELECT current_salary.currency, COUNT(*) AS employee_count,
            SUM(current_salary.new_salary_minor) AS payroll_minor,
            AVG(current_salary.new_salary_minor) AS average_minor,
            MIN(current_salary.new_salary_minor) AS min_minor,
            MAX(current_salary.new_salary_minor) AS max_minor
            FROM employees AS e {salary_join}{salary_where}
            GROUP BY current_salary.currency ORDER BY current_salary.currency""",
            [*salary_values, *values],
        ).fetchall()
    medians = get_salary_values(
        group_by=None,
        filters={
            "search": search,
            "country": country,
            "department": department,
            "job_title": job_title,
            "employment_status": employment_status,
            "currency": currency,
        },
        as_of=as_of,
    )
    values_by_currency: dict[str, list[int]] = {}
    for sample in medians:
        values_by_currency.setdefault(sample["currency"], []).append(sample["salary_minor"])
    median_by_currency = {
        sample_currency: _median(salary_values)
        for sample_currency, salary_values in values_by_currency.items()
    }
    for row in by_currency:
        row["payroll_minor"] = int(row["payroll_minor"])
        row["average_minor"] = float(row["average_minor"])
        row["median_minor"] = median_by_currency.get(row["currency"])
    return {
        "total_employees": total,
        "by_country": by_country,
        "by_department": by_department,
        "salary_by_currency": by_currency,
    }


def get_employee(employee_id: int, as_of: str) -> dict | None:
    """Return one employee with the compensation current on a given date."""
    salary_join, salary_values = _current_salary_join(as_of)
    with connect() as db:
        return db.execute(
            f"""SELECT e.id, e.employee_code, e.first_name, e.last_name, e.email, e.country,
            e.department, e.job_title, e.employment_status, e.created_at,
            current_salary.new_salary_minor AS salary_minor, current_salary.currency,
            current_salary.effective_date AS salary_effective_date
            FROM employees AS e {salary_join} WHERE e.id = ?""",
            [*salary_values, employee_id],
        ).fetchone()


def get_salary_values(*, group_by: str | None, filters: dict[str, str], as_of: str) -> list[dict]:
    """Fetch salary amounts without employee identifiers for local aggregation."""
    group_columns = {
        "country": "e.country",
        "department": "e.department",
        "designation": "e.job_title",
        "employment_status": "e.employment_status",
        "currency": "current_salary.currency",
    }
    group_column = group_columns.get(group_by) if group_by else None
    salary_join, salary_values = _current_salary_join(as_of)
    where, values = _where_clause(
        filters.get("search", ""),
        filters.get("country", ""),
        filters.get("department", ""),
        filters.get("job_title", ""),
        filters.get("employment_status", ""),
        filters.get("currency", ""),
    )
    where += " AND current_salary.currency IS NOT NULL" if where else " WHERE current_salary.currency IS NOT NULL"
    group_select = f", {group_column} AS group_value" if group_column and group_by != "currency" else ""
    with connect() as db:
        return db.execute(
            f"""SELECT current_salary.currency, current_salary.new_salary_minor AS salary_minor
            {group_select} FROM employees AS e {salary_join}{where}""",
            [*salary_values, *values],
        ).fetchall()


def _median(values: list[int]) -> float:
    """Return the midpoint for a sorted or unsorted salary list."""
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return float(ordered[middle])
    return (ordered[middle - 1] + ordered[middle]) / 2
