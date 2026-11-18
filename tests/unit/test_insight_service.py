"""InsightService logic with the repository replaced by in-memory data."""
import unittest
from unittest.mock import patch

from backend.services.insights import InsightArgumentError, InsightService

OPTIONS = {
    "countries": ["India", "United States"],
    "departments": ["Design", "Engineering"],
    "job_titles": ["Engineer"],
    "employment_statuses": ["Active", "Inactive"],
    "currencies": ["INR", "USD"],
}
REPO = "backend.services.insights.employee_repository"


def service():
    """Build a service with a fixed date so results are deterministic."""
    return InsightService(today_provider=lambda: "2026-01-01")


class FilterTests(unittest.TestCase):
    """Model- or user-supplied filters are matched against known directory values."""

    def test_filters_are_matched_case_insensitively(self):
        """Return the canonical spelling for a known value."""
        with patch(f"{REPO}.get_filter_options", return_value=OPTIONS):
            self.assertEqual(service().normalize_filters({"country": "INDIA", "currency": "inr"}),
                             {"country": "India", "currency": "INR"})

    def test_unknown_values_are_rejected(self):
        """An unknown value raises instead of silently returning an empty report."""
        with patch(f"{REPO}.get_filter_options", return_value=OPTIONS), \
                self.assertRaisesRegex(InsightArgumentError, "Unknown country filter: Atlantis"):
            service().normalize_filters({"country": "Atlantis"})

    def test_empty_values_are_ignored(self):
        """Blank or missing filters mean 'no filter'."""
        with patch(f"{REPO}.get_filter_options", return_value=OPTIONS):
            self.assertEqual(service().normalize_filters({"country": "", "department": None}), {})


class BreakdownTests(unittest.TestCase):
    """Breakdowns group salaries per dimension and currency."""

    def test_groups_are_split_by_currency(self):
        """The same group in two currencies yields two rows."""
        samples = [
            {"group_value": "Engineering", "currency": "INR", "salary_minor": 100},
            {"group_value": "Engineering", "currency": "INR", "salary_minor": 300},
            {"group_value": "Engineering", "currency": "USD", "salary_minor": 50},
        ]
        with patch(f"{REPO}.get_filter_options", return_value=OPTIONS), \
                patch(f"{REPO}.get_salary_values", return_value=samples):
            result = service().get_breakdown("department")
        rows = {(r["group"], r["currency"]): r for r in result["results"]}
        self.assertEqual(rows[("Engineering", "INR")]["median_minor"], 200)
        self.assertEqual(rows[("Engineering", "USD")]["employee_count"], 1)

    def test_unknown_dimension_is_rejected(self):
        """Only allowlisted dimensions can be used for grouping."""
        with self.assertRaises(InsightArgumentError):
            service().get_breakdown("salary")


class OutlierTests(unittest.TestCase):
    """Outliers use the 1.5xIQR rule within each currency."""

    def test_salary_outliers_use_iqr_fences_within_currency(self):
        """One extreme salary is counted above the upper fence; none below."""
        samples = [{"currency": "INR", "salary_minor": amount} for amount in [10, 12, 14, 16, 18, 20, 22, 24, 100]]
        with patch(f"{REPO}.get_filter_options", return_value=OPTIONS), \
                patch(f"{REPO}.get_salary_values", return_value=samples):
            result = service().get_outliers()
        row = result["results"][0]
        self.assertEqual(result["iqr_multiplier"], 1.5)
        self.assertEqual((row["q1_minor"], row["q3_minor"]), (14, 22))
        self.assertEqual((row["lower_fence_minor"], row["upper_fence_minor"]), (2, 34))
        self.assertEqual((row["lower_outlier_count"], row["upper_outlier_count"]), (0, 1))
