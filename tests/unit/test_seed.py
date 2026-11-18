"""Deterministic seed generator: volume, uniqueness and history invariants."""
import unittest
from collections import Counter, defaultdict
from datetime import date
from statistics import median_low

from backend.seed import COUNTRIES, DEPARTMENTS, generate

TODAY = date(2026, 11, 18)


class SeedGeneratorTests(unittest.TestCase):
    """The generator is pure, so it can be checked without a database."""

    @classmethod
    def setUpClass(cls):
        """Generate one mid-sized organisation shared by the tests."""
        cls.data = generate(2_000, today=TODAY)
        cls.history = defaultdict(list)
        for row in cls.data.salary_records:
            cls.history[row[0]].append(row)

    def test_same_inputs_give_identical_output(self):
        """Seeding is reproducible for a given date and seed value."""
        self.assertEqual(generate(50, today=TODAY), generate(50, today=TODAY))
        self.assertNotEqual(generate(50, today=TODAY), generate(50, today=TODAY, seed_value=1))

    def test_codes_and_emails_are_unique(self):
        """Unique keys never collide."""
        employees = self.data.employees
        self.assertEqual(len({row[1] for row in employees}), len(employees))
        self.assertEqual(len({row[4] for row in employees}), len(employees))

    def test_designations_belong_to_their_department(self):
        """A designation only appears in the department that owns it."""
        allowed = {dept: {title for title, _ in spec[1]} for dept, spec in DEPARTMENTS.items()}
        for row in self.data.employees:
            self.assertIn(row[7], allowed[row[6]])

    def test_every_country_and_both_statuses_are_present(self):
        """The population spans all configured markets and statuses."""
        self.assertEqual({row[5] for row in self.data.employees}, {c.name for c in COUNTRIES})
        self.assertEqual(set(Counter(row[8] for row in self.data.employees)), {"Active", "Inactive"})

    def test_history_is_ordered_linked_and_unique_per_date(self):
        """Each record's previous salary equals the prior record; dates strictly increase."""
        for records in self.history.values():
            self.assertIsNone(records[0][1])
            self.assertEqual(records[0][6], "Initial salary record")
            dates = [r[5] for r in records]
            self.assertEqual(dates, sorted(set(dates)))
            for earlier, later in zip(records, records[1:]):
                self.assertEqual(later[1], earlier[3])

    def test_only_scheduled_reviews_are_in_the_future(self):
        """Future-dated records exist (to demo scheduling) and are clearly labelled."""
        future = [r for r in self.data.salary_records if r[5] > TODAY.isoformat()]
        self.assertTrue(future)
        self.assertEqual({r[6] for r in future}, {"Scheduled annual review"})

    def test_pay_reflects_seniority(self):
        """Within one country, staff engineers out-earn software engineers on median."""
        current = {emp: [r for r in recs if r[5] <= TODAY.isoformat()][-1][3] for emp, recs in self.history.items()}
        by_title = defaultdict(list)
        for row in self.data.employees:
            if row[5] == "India":
                by_title[row[7]].append(current[row[0]])
        self.assertGreater(median_low(by_title["Staff Engineer"]), median_low(by_title["Software Engineer"]))

    def test_count_must_be_positive(self):
        """Zero employees is a usage error."""
        with self.assertRaises(ValueError):
            generate(0, today=TODAY)
