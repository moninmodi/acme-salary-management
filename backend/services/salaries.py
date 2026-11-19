"""Salary-record business rules and transaction handling."""
from __future__ import annotations

from datetime import datetime, timezone

import pymysql

from backend.db import connect
from backend.repositories import salaries as salary_repository
from backend.schemas import SalaryRecordCreate


class SalaryRecordError(Exception):
    """Business-rule failure with an HTTP-compatible status and explanation."""

    def __init__(self, status_code: int, detail: str):
        """Initialize a domain error that can be mapped by the API layer."""
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class SalaryService:
    """Create effective-dated salary records without overwriting history."""

    def create_record(self, employee_id: int, record: SalaryRecordCreate) -> dict:
        """Validate and atomically append a current or future salary version."""
        today = datetime.now(timezone.utc).date()
        effective_date = record.effective_date
        reason = record.reason.strip()
        changed_by = record.changed_by.strip()
        if len(reason) < 3 or not changed_by:
            raise SalaryRecordError(422, "A reason and actor are required")
        if effective_date < today:
            raise SalaryRecordError(422, "Effective date cannot be in the past")

        changed_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
        try:
            with connect() as db:
                db.begin()
                if not salary_repository.lock_employee(db, employee_id):
                    raise SalaryRecordError(404, "Employee not found")
                previous = salary_repository.latest_salary_record(db, employee_id)
                if previous and effective_date <= previous["effective_date"]:
                    raise SalaryRecordError(422, "Effective date must be after the latest scheduled salary record")
                unchanged = previous and previous["new_salary_minor"] == record.salary_minor
                unchanged = unchanged and previous["currency"] == record.currency
                if unchanged:
                    raise SalaryRecordError(422, "New salary record must change the amount or currency")
                record_id = salary_repository.insert_salary_record(
                    db,
                    employee_id=employee_id,
                    previous=previous,
                    salary_minor=record.salary_minor,
                    currency=record.currency,
                    effective_date=effective_date.isoformat(),
                    reason=reason,
                    changed_by=changed_by,
                    changed_at=changed_at,
                )
        except pymysql.err.IntegrityError as exc:
            raise SalaryRecordError(409, "A salary record already exists for that effective date") from exc

        return {
            "id": record_id,
            "employee_id": employee_id,
            "salary_minor": record.salary_minor,
            "currency": record.currency,
            "effective_date": effective_date,
            "status": "current" if effective_date == today else "scheduled",
            "changed_at": changed_at,
        }
