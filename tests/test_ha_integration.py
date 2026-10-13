"""Integration routing, local-calendar refresh and storage regression checks."""
import copy
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

from ha_test_support import Hass, ServiceValidationError, load_integration
from voluptuous import Invalid


class IntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.core, self.sensor, self.clock = load_integration()
        self.hass = Hass()
        self.store = self.core.BudgetStore(self.hass)
        await self.store.async_load()
        self.owner = self.store.active_book["id"]
        self.hass.data["budget_book"] = {"entry": {"store": self.store}}
        await self.core._async_register_services(self.hass)

    async def test_fixed_book_write_and_query_ignore_global_selection(self):
        family = await self.store.async_create_book("Family")
        await self.store.async_set_active_book(family)
        for bid, amount in ((self.owner, 120), (family, 250)):
            await self.hass.services.call("add_transaction", book_id=bid, date="2026-10-13",
                                          type="expense", amount=amount, category="food")
        response = await self.hass.services.call("get_book", book_id=self.owner)
        self.assertEqual(response["book"]["id"], self.owner)
        self.assertEqual(response["metrics"]["month_expense"], 120)
        self.assertEqual(self.store.active_book["id"], family)
        self.assertEqual((await self.hass.services.call("get_book", book_id=family))["metrics"]["month_expense"], 250)
        response["book"]["transactions"][0]["amount"] = 999
        self.assertEqual(self.store.books[self.owner]["transactions"][0]["amount"], 120)

    async def test_fixed_book_edit_and_delete_ignore_global_selection(self):
        await self.hass.services.call("add_transaction", book_id=self.owner, date="2026-10-13",
                                      type="expense", amount=120, category="food")
        tid = self.store.books[self.owner]["transactions"][0]["id"]
        family = await self.store.async_create_book("Family")
        await self.store.async_set_active_book(family)
        await self.hass.services.call("update_transaction", book_id=self.owner, transaction_id=tid,
                                      date="2026-10-13", type="expense", amount=150, category="food")
        self.assertEqual(self.store.books[self.owner]["transactions"][0]["amount"], 150)
        self.assertEqual(self.store.books[family]["transactions"], [])
        await self.hass.services.call("delete_transaction", book_id=self.owner, transaction_id=tid)
        self.assertEqual(self.store.books[self.owner]["transactions"], [])
        self.assertEqual(self.store.active_book["id"], family)

    async def test_query_requires_an_existing_explicit_book(self):
        with self.assertRaises(Invalid):
            await self.hass.services.call("get_book")
        with self.assertRaises(ServiceValidationError):
            await self.hass.services.call("get_book", book_id="missing")
        options = self.hass.services.registered[("budget_book", "get_book")][1]
        self.assertEqual(options["supports_response"].name, "ONLY")

    async def test_dining_note_survives_storage_and_edits(self):
        await self.hass.services.call("add_transaction", book_id=self.owner, date="2026-10-13",
                                      type="expense", amount=180, category="food", note="午餐｜Uber Eats")
        tid = self.store.books[self.owner]["transactions"][0]["id"]
        await self.hass.services.call("update_transaction", book_id=self.owner, transaction_id=tid,
                                      date="2026-10-13", type="expense", amount=190, category="food", note="晚餐｜foodpanda｜加飯")
        await self.store.async_save()
        restored = self.core.BudgetStore(self.hass)
        await restored.async_load()
        self.assertEqual(restored.books[self.owner]["transactions"][0]["note"], "晚餐｜foodpanda｜加飯")
        self.assertEqual(restored.books[self.owner]["transactions"][0]["amount"], 190)

    async def test_midnight_refreshes_month_without_a_transaction(self):
        self.clock.value = datetime(2026, 10, 31, 23, 59, tzinfo=ZoneInfo("Asia/Taipei"))
        await self.hass.services.call("add_transaction", book_id=self.owner, date="2026-10-31",
                                      type="expense", amount=120, category="food")
        coord = self.sensor.BudgetCoordinator(self.hass, self.store)
        await coord.async_init()
        await coord.async_init()
        self.assertEqual(len(self.hass.schedules), 1)
        self.assertEqual(coord.metrics["month_expense"], 120)
        refreshed = []
        coord.register(lambda: refreshed.append(True))
        self.clock.value = datetime(2026, 11, 1, 0, 0, tzinfo=ZoneInfo("Asia/Taipei"))
        self.hass.schedules[0]["callback"](self.clock.value)
        self.assertEqual(coord.metrics["month_label"], "2026-11")
        self.assertEqual(coord.metrics["month_expense"], 0)
        self.assertEqual(refreshed, [True])
        coord.async_shutdown()
        self.assertFalse(self.hass.schedules[0]["active"])
        self.assertFalse(self.hass.signals[0]["active"])

    async def test_invalid_persisted_data_is_preserved(self):
        key = self.store._store.key
        invalid = {"unexpected": "data"}
        self.hass.storage[key] = copy.deepcopy(invalid)
        with self.assertRaises(ValueError):
            await self.core.BudgetStore(self.hass).async_load()
        self.assertEqual(self.hass.storage[key], invalid)


if __name__ == "__main__":
    unittest.main()
