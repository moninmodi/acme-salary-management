"""Salary-record business rules with the database layer replaced by fakes."""
import unittest
from contextlib import nullcontext
from datetime import date, datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from backend.schemas import SalaryRecordCreate
from backend.services.salaries import SalaryRecordError, SalaryService

TODAY = datetime.now(timezone.utc).date()
REPO = "backend.services.salaries.salary_repository"


def record(amount=9_000_000, currency="INR", effective=TODAY, reason="Annual review"):
    """Build a valid salary-record request."""
    return SalaryRecordCreate(salary_minor=amount, currency=currency, effective_date=effective, reason=reason)


class SalaryServiceTests(unittest.TestCase):
    """Validation happens before writing; history is append-only."""

    def setUp(self):
        """Replace the connection and repository with in-memory fakes."""
        self.db = MagicMock()
        self.addCleanup(patch.stopall)
        patch("backend.services.salaries.connect", return_value=nullcontext(self.db)).start()
        self.exists = patch(f"{REPO}.employee_exists", return_value=True).start()
        self.latest = patch(f"{REPO}.latest_salary_record", return_value={
            "new_salary_minor": 8_500_000, "currency": "INR", "effective_date": date(2025, 1, 1),
        }).start()
        self.insert = patch(f"{REPO}.insert_salary_record", return_value=77).start()

    def assert_rejected(self, request, status, message):
        """Assert the request fails with ``status`` and nothing is written."""
        with self.assertRaises(SalaryRecordError) as ctx:
            SalaryService().create_record(1, request)
        self.assertEqual(ctx.exception.status_code, status)
        self.assertIn(message, ctx.exception.detail)
        self.insert.assert_not_called()

    def test_effective_today_becomes_current(self):
        """A record effective today is current and links the previous salary."""
        result = SalaryService().create_record(1, record())
        self.assertEqual((result["id"], result["status"]), (77, "current"))
        self.assertEqual(self.insert.call_args.kwargs["previous"]["new_salary_minor"], 8_500_000)

    def test_future_record_is_scheduled(self):
        """A future record is accepted but reported as scheduled."""
        result = SalaryService().create_record(1, record(effective=TODAY + timedelta(days=30)))
        self.assertEqual(result["status"], "scheduled")

    def test_past_dates_are_rejected_before_touching_the_database(self):
        """Back-dating would rewrite history, so it is refused up front."""
        self.assert_rejected(record(effective=TODAY - timedelta(days=1)), 422, "past")
        self.exists.assert_not_called()

    def test_blank_reason_is_rejected(self):
        """Whitespace does not count as a reason."""
        self.assert_rejected(record(reason="   x  "), 422, "reason")

    def test_unknown_employee_is_404(self):
        """A missing employee maps to not found."""
        self.exists.return_value = False
        self.assert_rejected(record(), 404, "not found")

    def test_must_follow_latest_record(self):
        """A record dated on or before the latest one would break ordering."""
        self.latest.return_value["effective_date"] = TODAY + timedelta(days=10)
        self.assert_rejected(record(effective=TODAY + timedelta(days=5)), 422, "after the latest")

    def test_must_change_amount_or_currency(self):
        """A no-op record is rejected; a currency change alone is allowed."""
        self.assert_rejected(record(amount=8_500_000), 422, "must change")
        self.assertEqual(SalaryService().create_record(1, record(amount=8_500_000, currency="USD"))["id"], 77)

    def test_negative_amount_and_bad_currency_fail_schema_validation(self):
        """Pydantic rejects invalid payloads before the service runs."""
        with self.assertRaises(ValueError):
            record(amount=-1)
        with self.assertRaises(ValueError):
            record(currency="rupees")
