"""Calendar boundaries shared by the integration and add-on."""
import importlib.util
import unittest
from datetime import date
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "shared/core/analytics.py"
spec = importlib.util.spec_from_file_location("shared_budget_analytics", path)
analytics = importlib.util.module_from_spec(spec)
spec.loader.exec_module(analytics)


def book_with_rule(day, last_run=None):
    return {
        "transactions": [], "categories": [], "budgets": {},
        "recurring": [{
            "id": "rent", "name": "Rent", "amount": 100, "type": "expense",
            "category": "rent", "day_of_month": day, "active": True,
            "last_run_date": last_run,
        }],
    }


class RecurringDateTests(unittest.TestCase):
    def test_31st_keeps_actual_day_in_long_month(self):
        book = book_with_rule(31)
        self.assertEqual(analytics.find_due_recurring(book, date(2026, 10, 28)), [])
        self.assertEqual(analytics.find_due_recurring(book, date(2026, 10, 30)), [])
        self.assertEqual(len(analytics.find_due_recurring(book, date(2026, 10, 31))), 1)

    def test_short_months_only_fall_back_to_their_last_day(self):
        for today, expected in ((date(2026, 4, 29), False), (date(2026, 4, 30), True),
                                (date(2026, 2, 27), False), (date(2026, 2, 28), True),
                                (date(2028, 2, 28), False), (date(2028, 2, 29), True)):
            with self.subTest(today=today):
                self.assertEqual(bool(analytics.find_due_recurring(book_with_rule(31), today)), expected)

    def test_all_allowed_days_across_normal_and_leap_years(self):
        for year in (2026, 2028):
            for month in range(1, 13):
                end = analytics.month_range(year, month)[1]
                for day in range(1, 32):
                    with self.subTest(year=year, month=month, day=day):
                        due = analytics.recurring_due_date(year, month, day)
                        self.assertEqual(due.day, min(day, end.day))
                        self.assertTrue(analytics.find_due_recurring(book_with_rule(day), due))

    def test_already_run_this_month_is_not_repeated(self):
        self.assertEqual(analytics.find_due_recurring(book_with_rule(31, "2026-10-31"), date(2026, 10, 31)), [])

    def test_earlier_month_does_not_block_this_month(self):
        self.assertEqual(len(analytics.find_due_recurring(book_with_rule(31, "2026-09-30"), date(2026, 10, 31))), 1)

    def test_upcoming_date_is_recomputed_for_next_month_length(self):
        for today, expected in ((date(2026, 4, 1), "2026-04-30"),
                                (date(2026, 1, 31), "2026-01-31"),
                                (date(2026, 2, 28), "2026-02-28"),
                                (date(2028, 2, 1), "2028-02-29"),
                                (date(2026, 4, 30), "2026-05-29")):
            day = 29 if today == date(2026, 4, 30) else 31
            with self.subTest(today=today, day=day):
                upcoming = analytics.compute_book_metrics(book_with_rule(day), today)["recurring_upcoming"]
                self.assertEqual(upcoming[0]["due_date"], expected)

    def test_year_rollover(self):
        upcoming = analytics.compute_book_metrics(book_with_rule(30), date(2026, 12, 31))["recurring_upcoming"]
        self.assertEqual(upcoming[0]["due_date"], "2027-01-30")


if __name__ == "__main__":
    unittest.main()
