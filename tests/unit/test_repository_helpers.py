"""SQL-building and row-normalisation helpers in the employee repository."""
import json
import unittest
from decimal import Decimal

from backend.repositories.employees import _normalize_numeric, _where_clause


class WhereClauseTests(unittest.TestCase):
    """Filters become parameterised SQL; values never reach the SQL text."""

    def test_no_filters_means_no_where_clause(self):
        """An unfiltered directory produces an empty clause and no parameters."""
        self.assertEqual(_where_clause("", "", "", "", ""), ("", []))

    def test_filters_are_parameterised_and_combined_with_and(self):
        """Every filter becomes a placeholder; user input stays in the parameter list."""
        sql, values = _where_clause("Ann'; DROP TABLE employees;--", "India", "", "Engineer", "Active", "INR")
        self.assertTrue(sql.startswith(" WHERE "))
        self.assertNotIn("DROP", sql)
        self.assertEqual(sql.count("?"), 3 + 4)  # search matches 3 columns
        self.assertIn("current_salary.currency = ?", sql)
        self.assertEqual(values[-4:], ["India", "Engineer", "Active", "INR"])
        self.assertEqual(values[0], "%Ann'; DROP TABLE employees;--%")


class NormalizeNumericTests(unittest.TestCase):
    """MariaDB DECIMAL aggregates must become JSON-serialisable numbers."""

    def test_decimals_become_int_or_float(self):
        """Totals become ints, averages keep their fraction, other values are untouched."""
        row = {"currency": "INR", "payroll_minor": Decimal("1200"), "average_minor": Decimal("400.5"),
               "min_minor": 100}
        _normalize_numeric(row)
        self.assertEqual(row, {"currency": "INR", "payroll_minor": 1200, "average_minor": 400.5,
                               "min_minor": 100})
        self.assertIsInstance(row["payroll_minor"], int)
        json.dumps(row)  # regression: Decimal used to crash the Gemini phrasing prompt
