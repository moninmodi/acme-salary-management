"""Integration tests against the disposable MariaDB test schema.

Run ``docker compose up -d mariadb`` first. The whole module is skipped (not failed) when the
test database is unreachable, so ``python -m unittest`` still runs the unit suite anywhere.
"""
import os
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pymysql
from fastapi.testclient import TestClient

from backend.db import DB_CONFIG, DatabaseSession, connect, initialize
from backend.main import app
from backend.seed import seed
from backend.services.insights import GeminiQuestionService, InsightService
from tests.fakes import FakeGeminiClient, model_text, model_tool_call


def test_database_config():
    """Return connection settings for the isolated test database."""
    return {**DB_CONFIG, "database": os.getenv("SALARY_TEST_DB_NAME", "acme_salary_test")}


def setUpModule():  # pylint: disable=invalid-name
    """Skip this module with a clear reason when the MariaDB test schema is unavailable."""
    try:
        DatabaseSession(test_database_config()).connection.close()
    except pymysql.MySQLError as exc:
        raise unittest.SkipTest(f"MariaDB test database unavailable ({exc}); run `docker compose up -d mariadb`")


def clear_test_database():
    """Reset the disposable schema to a clean state before each test."""
    with connect() as db:
        db.execute("DROP TABLE IF EXISTS salary_history")
        db.execute("DROP TABLE IF EXISTS salary_records")
        db.execute("DROP TABLE IF EXISTS employees")
    initialize()


class ApiTestCase(unittest.TestCase):
    """Base fixture: a three-employee dataset in the disposable schema and a test client."""

    def setUp(self):
        """Create a small, deterministic dataset for one API test."""
        self.db_config_patch = patch("backend.db.DB_CONFIG", test_database_config())
        self.db_config_patch.start()
        clear_test_database()
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with connect() as db:
            db.executemany("""INSERT INTO employees
                (id, employee_code, first_name, last_name, email, country, department, job_title,
                 employment_status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", [
                (1, "AC-00001", "Asha", "Shah", "asha@example.test", "India", "Engineering", "Engineer", "Active", now),
                (2, "AC-00002", "Lee", "Kim", "lee@example.test", "India", "Design", "Designer", "Inactive", now),
                (3, "AC-00003", "Avery", "Brown", "avery@example.test", "United States",
                 "Engineering", "Engineer", "Active", now),
            ])
            db.executemany("""INSERT INTO salary_records
                (employee_id, previous_salary_minor, previous_currency, new_salary_minor,
                 currency, effective_date, reason, changed_by, changed_at)
                VALUES (?, NULL, NULL, ?, ?, '2025-01-01', 'Initial salary record', 'System', ?)""", [
                (1, 8_500_000, "INR", now), (2, 9_500_000, "INR", now), (3, 12_000_000, "USD", now),
            ])
        self.addCleanup(self.db_config_patch.stop)
        self.client = self.enterContext(TestClient(app))


class SalaryApiTests(ApiTestCase):
    """Exercise employee APIs and effective-dated salary behavior."""

    def test_search_combined_filters_status_sort_and_bounded_pagination(self):
        """Verify combined filters return the correct result and page limit."""
        params = {
            "search": "AC-", "country": "India", "department": "Engineering",
            "employment_status": "Active", "limit": 1,
        }
        response = self.client.get("/api/employees", params=params)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 1)
        self.assertEqual(response.json()["items"][0]["employee_code"], "AC-00001")
        too_many = self.client.get("/api/employees", params={"limit": 101})
        self.assertEqual(too_many.status_code, 422)

    def test_summary_reports_employee_distribution_and_currency_groups(self):
        """Verify employee counts and salary aggregates stay currency-specific."""
        response = self.client.get("/api/summary", params={"department": "Engineering"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_employees"], 2)
        self.assertEqual(
            data["by_country"],
            [{"country": "India", "employee_count": 1},
             {"country": "United States", "employee_count": 1}],
        )
        groups = {row["currency"]: row for row in data["salary_by_currency"]}
        self.assertEqual(set(groups), {"INR", "USD"})
        self.assertEqual(groups["INR"]["employee_count"], 1)
        self.assertEqual(groups["INR"]["average_minor"], 8_500_000)
        self.assertEqual(groups["INR"]["median_minor"], 8_500_000)
        self.assertEqual(groups["INR"]["min_minor"], groups["INR"]["max_minor"])

    def test_future_salary_record_is_scheduled_without_changing_current_salary(self):
        """Ensure a future record is visible in history but not current compensation."""
        effective_date = (datetime.now(timezone.utc).date() + timedelta(days=7)).isoformat()
        response = self.client.post(
            "/api/employees/1/salaries",
            json={"salary_minor": 9_000_000, "currency": "INR", "effective_date": effective_date,
                  "reason": "Annual review"},
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["status"], "scheduled")
        current = self.client.get("/api/employees/1").json()
        self.assertEqual(current["salary_minor"], 8_500_000)
        self.assertEqual(current["salary_effective_date"], "2025-01-01")
        history = self.client.get("/api/employees/1/history").json()["items"]
        self.assertEqual(history[0]["new_salary_minor"], 9_000_000)
        self.assertEqual(history[0]["effective_date"], effective_date)

    def test_salary_effective_today_becomes_current_and_is_audited(self):
        """Ensure a salary effective today becomes current and preserves history."""
        effective_date = datetime.now(timezone.utc).date().isoformat()
        response = self.client.post(
            "/api/employees/1/salaries",
            json={"salary_minor": 9_000_000, "currency": "INR", "effective_date": effective_date,
                  "reason": "Promotion"},
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["status"], "current")
        current = self.client.get("/api/employees/1").json()
        self.assertEqual(current["salary_minor"], 9_000_000)
        history = self.client.get("/api/employees/1/history").json()["items"]
        self.assertEqual(history[0]["previous_salary_minor"], 8_500_000)
        self.assertEqual(history[0]["reason"], "Promotion")
        self.assertTrue(history[0]["changed_at"].endswith("+00:00"))

    def test_invalid_or_out_of_order_record_does_not_change_current_salary(self):
        """Reject invalid salary versions without changing current state or history."""
        past = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
        today = datetime.now(timezone.utc).date().isoformat()
        unchanged = self.client.post(
            "/api/employees/1/salaries",
            json={"salary_minor": 8_500_000, "currency": "INR", "effective_date": today,
                  "reason": "No change"},
        )
        invalid = self.client.post(
            "/api/employees/1/salaries",
            json={"salary_minor": -1, "currency": "INR", "effective_date": past, "reason": "Bad value"},
        )
        self.assertEqual(unchanged.status_code, 422)
        self.assertEqual(invalid.status_code, 422)
        self.assertEqual(len(self.client.get("/api/employees/1/history").json()["items"]), 1)
        self.assertEqual(self.client.get("/api/employees/1").json()["salary_minor"], 8_500_000)

    def test_unknown_employee_returns_not_found(self):
        """Return a not-found response when salary history targets no employee."""
        response = self.client.post(
            "/api/employees/999/salaries",
            json={"salary_minor": 1, "currency": "USD",
                  "effective_date": datetime.now(timezone.utc).date().isoformat(), "reason": "Correction"},
        )
        self.assertEqual(response.status_code, 404)

    def test_question_endpoint_validates_tool_and_returns_verified_aggregates(self):
        """Execute a model-selected summary and return its verified filters and data."""
        service = GeminiQuestionService(
            api_key="test-key", model="test-model", insight_service=InsightService(),
            client=FakeGeminiClient(
                model_tool_call("get_summary", {"country": "India"}),
                model_text("India has two employees, with INR salaries kept separate."),
            ),
        )
        with patch("backend.api.routes.question_service", service):
            response = self.client.post("/api/questions", json={"question": "How many employees are in India?"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["tool_name"], "get_summary")
        self.assertEqual(data["filters"]["country"], "India")
        self.assertEqual(sum(row["employee_count"] for row in data["results"]), 2)
        self.assertIn("two employees", data["answer"])

    def test_question_endpoint_keeps_breakdown_results_grouped_by_currency(self):
        """Return the exact grouped aggregates, without merging currencies."""
        service = GeminiQuestionService(
            api_key="test-key", model="test-model", insight_service=InsightService(),
            client=FakeGeminiClient(
                model_tool_call("get_breakdown", {"by": "country"}),
                model_text("Compensation is reported separately by currency."),
            ),
        )
        with patch("backend.api.routes.question_service", service):
            response = self.client.post("/api/questions", json={"question": "Show salary by country."})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["group_by"], "country")
        self.assertEqual({row["currency"] for row in data["results"]}, {"INR", "USD"})

    def test_question_endpoint_rejects_invalid_tool_arguments(self):
        """Reject model arguments outside the Pydantic allowlist before querying."""
        service = GeminiQuestionService(
            api_key="test-key", model="test-model",
            client=FakeGeminiClient(model_tool_call("get_breakdown", {"by": "salary", "sql": "DROP TABLE"})),
        )
        with patch("backend.api.routes.question_service", service):
            response = self.client.post("/api/questions", json={"question": "Show compensation."})
        self.assertEqual(response.status_code, 422)

    def test_question_endpoint_is_disabled_without_gemini_key(self):
        """Return a clear disabled response when no model credentials are configured."""
        service = GeminiQuestionService(api_key="", model="test-model")
        with patch("backend.api.routes.question_service", service):
            response = self.client.post("/api/questions", json={"question": "Show salary statistics."})
        self.assertEqual(response.status_code, 503)
        self.assertIn("GEMINI_API_KEY", response.json()["detail"])

    def test_feature_endpoint_reports_question_availability(self):
        """Expose the configured optional question feature to the client."""
        service = GeminiQuestionService(api_key="test-key", model="test-model", client=FakeGeminiClient())
        with patch("backend.api.routes.question_service", service):
            response = self.client.get("/api/features")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["natural_language_questions"])


class ReportingApiTests(ApiTestCase):
    """Exercise the pay-insight endpoints used by the dashboard."""

    def test_breakdown_groups_by_dimension_without_mixing_currencies(self):
        """Group by department and keep INR and USD statistics in separate rows."""
        response = self.client.get("/api/insights/breakdown", params={"by": "department"})
        self.assertEqual(response.status_code, 200)
        rows = {(row["group"], row["currency"]): row for row in response.json()["results"]}
        self.assertEqual(set(rows), {("Design", "INR"), ("Engineering", "INR"), ("Engineering", "USD")})
        self.assertEqual(rows[("Engineering", "USD")]["median_minor"], 12_000_000)

    def test_breakdown_filters_are_case_insensitive_and_validated(self):
        """Match known filter values case-insensitively and reject unknown ones with 422."""
        ok = self.client.get("/api/insights/breakdown", params={"by": "country", "country": "india"})
        self.assertEqual(ok.json()["filters"], {"country": "India"})
        unknown = self.client.get("/api/insights/breakdown", params={"by": "country", "country": "Mars"})
        self.assertEqual(unknown.status_code, 422)
        bad_dimension = self.client.get("/api/insights/breakdown", params={"by": "salary"})
        self.assertEqual(bad_dimension.status_code, 422)

    def test_outliers_report_counts_per_currency(self):
        """Return aggregate outlier fences and counts, one row per currency."""
        response = self.client.get("/api/insights/outliers")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["currency"] for row in response.json()["results"]], ["INR", "USD"])

    def test_options_list_filter_values(self):
        """Expose the distinct directory values that populate the UI filters."""
        options = self.client.get("/api/options").json()
        self.assertEqual(options["countries"], ["India", "United States"])
        self.assertEqual(options["currencies"], ["INR", "USD"])


class SeedTests(unittest.TestCase):
    """Check deterministic seed volume and idempotence."""

    def test_seed_creates_ten_thousand_records_and_is_safe_to_repeat(self):
        """Create ten thousand varied employees once without duplicate reseeding."""
        with patch("backend.db.DB_CONFIG", test_database_config()):
            clear_test_database()
            self.assertEqual(seed(count=10_000), 10_000)
            self.assertEqual(seed(count=10_000), 10_000)
            with connect() as db:
                self.assertEqual(db.execute("SELECT COUNT(*) AS total FROM employees").fetchone()["total"], 10_000)
                currencies = db.execute(
                    "SELECT COUNT(DISTINCT currency) AS total FROM salary_records"
                ).fetchone()["total"]
                statuses = db.execute(
                    "SELECT COUNT(DISTINCT employment_status) AS total FROM employees"
                ).fetchone()["total"]
                self.assertEqual(currencies, 6)
                self.assertEqual(statuses, 2)
                mismatched = db.execute(
                    """SELECT COUNT(*) AS total FROM salary_records AS later
                    JOIN salary_records AS earlier ON earlier.employee_id = later.employee_id
                    AND earlier.effective_date = (SELECT MAX(s.effective_date) FROM salary_records AS s
                        WHERE s.employee_id = later.employee_id AND s.effective_date < later.effective_date)
                    WHERE later.previous_salary_minor <> earlier.new_salary_minor"""
                ).fetchone()["total"]
                self.assertEqual(mismatched, 0, "each record's previous salary must equal the prior record")


if __name__ == "__main__":
    unittest.main()
