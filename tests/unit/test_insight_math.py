"""Pure statistics helpers behind every salary insight."""
import unittest

from backend.repositories.employees import _median
from backend.services.insights import _quantile, _statistics


class QuantileTests(unittest.TestCase):
    """Linear-interpolated quantiles match the usual PERCENTILE_CONT definition."""

    def test_single_value(self):
        """A one-element cohort has the same value at every quantile."""
        self.assertEqual(_quantile([42], 0.25), 42.0)

    def test_quartiles_interpolate_between_ranks(self):
        """Quartiles of 1..4 fall between neighbouring values."""
        self.assertEqual(_quantile([4, 1, 3, 2], 0.25), 1.75)
        self.assertEqual(_quantile([1, 2, 3, 4], 0.5), 2.5)
        self.assertEqual(_quantile([1, 2, 3, 4], 0.75), 3.25)

    def test_extremes(self):
        """The 0th and 100th percentiles are the minimum and maximum."""
        self.assertEqual(_quantile([5, 9, 7], 0.0), 5)
        self.assertEqual(_quantile([5, 9, 7], 1.0), 9)


class StatisticsTests(unittest.TestCase):
    """Cohort statistics used by summaries and breakdowns."""

    def test_statistics_of_a_cohort(self):
        """Count, payroll, average, median and range are computed from minor units."""
        self.assertEqual(
            _statistics([300, 100, 200, 400]),
            {"employee_count": 4, "payroll_minor": 1000, "average_minor": 250.0,
             "median_minor": 250.0, "min_minor": 100, "max_minor": 400},
        )

    def test_median_handles_odd_and_even_sizes(self):
        """The repository median matches the statistics median."""
        self.assertEqual(_median([3, 1, 2]), 2.0)
        self.assertEqual(_median([4, 1, 3, 2]), 2.5)
