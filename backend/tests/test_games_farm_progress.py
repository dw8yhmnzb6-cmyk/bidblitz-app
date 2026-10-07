"""Tests for BidBlitz Farm account-backed progress."""
import asyncio
import types
import unittest
from unittest.mock import AsyncMock

from fastapi import HTTPException
from pydantic import ValidationError

from routes import games_farm_progress as farm


class DuplicateKeyError(Exception):
    code = 11000


class Collection:
    def __init__(self):
        self.docs = []

    async def find_one(self, query, projection=None):
        for doc in self.docs:
            if all(doc.get(k) == v for k, v in query.items()):
                return dict(doc)
        return None

    async def insert_one(self, doc):
        if any(row.get("owner_id") == doc.get("owner_id") for row in self.docs):
            raise DuplicateKeyError()
        self.docs.append(dict(doc))
        return types.SimpleNamespace(inserted_id=doc.get("owner_id"))

    async def update_one(self, query, update):
        for doc in self.docs:
            if all(doc.get(k) == v for k, v in query.items()):
                doc.update(update.get("$set", {}))
                for key, value in update.get("$inc", {}).items():
                    doc[key] = int(doc.get(key) or 0) + value
                return types.SimpleNamespace(matched_count=1)
        return types.SimpleNamespace(matched_count=0)


def state(day=1, seed=123456, xp=0, coins=60, harvests=0):
    season = farm._season_for_day(day)
    return {
        "version": 1,
        "seed": seed,
        "day": day,
        "season": season,
        "weather": farm._weather_for(seed, day, season),
        "coins": coins,
        "xp": xp,
        "level": farm._level_from_xp(xp),
        "harvests": harvests,
        "plots": [
            {
                "id": i,
                "crop": None,
                "plantedDay": None,
                "growth": 0,
                "watered": False,
                "health": 100,
                "ready": False,
            }
            for i in range(1, 7)
        ],
        "lastEvent": "Farm bereit.",
    }


class GamesFarmProgressTest(unittest.TestCase):
    def setUp(self):
        self.collection = Collection()
        farm.db = types.SimpleNamespace(games_farm_progress=self.collection)
        farm.get_current_user = AsyncMock(return_value={"_id": "alice"})

    def test_empty_account_then_first_save(self):
        empty = asyncio.run(farm.get_farm_progress(None))
        self.assertFalse(empty["exists"])
        saved = asyncio.run(farm.save_farm_progress(
            farm.FarmSaveInput(revision=0, state=farm.FarmStateInput(**state())),
            None,
        ))
        self.assertTrue(saved["exists"])
        self.assertEqual(saved["revision"], 1)
        self.assertEqual(saved["state"]["coins"], 60)

    def test_revision_conflict_returns_current_server_snapshot(self):
        first = asyncio.run(farm.save_farm_progress(
            farm.FarmSaveInput(revision=0, state=farm.FarmStateInput(**state())),
            None,
        ))
        second_state = state(day=2, xp=40, coins=70, harvests=1)
        second = asyncio.run(farm.save_farm_progress(
            farm.FarmSaveInput(revision=first["revision"], state=farm.FarmStateInput(**second_state)),
            None,
        ))
        self.assertEqual(second["revision"], 2)

        with self.assertRaises(HTTPException) as context:
            asyncio.run(farm.save_farm_progress(
                farm.FarmSaveInput(revision=1, state=farm.FarmStateInput(**state(day=3, xp=80))),
                None,
            ))
        self.assertEqual(context.exception.status_code, 409)
        self.assertEqual(context.exception.detail["current"]["revision"], 2)

    def test_accounts_are_isolated(self):
        asyncio.run(farm.save_farm_progress(
            farm.FarmSaveInput(revision=0, state=farm.FarmStateInput(**state())),
            None,
        ))
        farm.get_current_user.return_value = {"_id": "bob"}
        self.assertFalse(asyncio.run(farm.get_farm_progress(None))["exists"])
        bob = asyncio.run(farm.save_farm_progress(
            farm.FarmSaveInput(revision=0, state=farm.FarmStateInput(**state(seed=77))),
            None,
        ))
        self.assertEqual(bob["state"]["seed"], 77)
        self.assertEqual(len(self.collection.docs), 2)

    def test_invalid_weather_level_and_plot_shape_are_rejected(self):
        bad_weather = state()
        bad_weather["weather"] = "storm" if bad_weather["weather"] != "storm" else "sunny"
        bad_level = state(xp=80)
        bad_level["level"] = 1
        bad_plot = state()
        bad_plot["plots"][0]["crop"] = "wheat"
        bad_plot["plots"][0]["plantedDay"] = None

        for value in (bad_weather, bad_level, bad_plot):
            with self.assertRaises(ValidationError):
                farm.FarmStateInput(**value)

    def test_animals_buildings_and_missions_are_validated(self):
        value = state()
        value["animals"] = {
            "chicken": {"count": 3, "fed": True, "progress": 0, "ready": 0},
            "cow": {"count": 0, "fed": False, "progress": 0, "ready": 0},
            "sheep": {"count": 0, "fed": False, "progress": 0, "ready": 0},
        }
        value["buildings"] = {"coop": 1, "barn": 1, "silo": 1}
        value["claimedMissions"] = ["harvest-5"]
        parsed = farm.FarmStateInput(**value)
        self.assertEqual(parsed.animals.chicken.count, 3)
        self.assertEqual(parsed.buildings.coop, 1)
        self.assertEqual(parsed.claimedMissions, ["harvest-5"])

        too_many = dict(value)
        too_many["animals"] = {
            **value["animals"],
            "chicken": {"count": 4, "fed": False, "progress": 0, "ready": 0},
        }
        with self.assertRaises(ValidationError):
            farm.FarmStateInput(**too_many)

        bad_mission = dict(value)
        bad_mission["claimedMissions"] = ["not-a-real-mission"]
        with self.assertRaises(ValidationError):
            farm.FarmStateInput(**bad_mission)

    def test_legacy_six_plot_snapshot_is_padded_and_expanded_land_is_valid(self):
        legacy = farm.FarmStateInput(**state())
        self.assertEqual(legacy.unlockedPlots, 6)
        self.assertEqual(len(legacy.plots), 12)
        self.assertEqual(legacy.plots[-1].id, 12)

        expanded = state(day=5, xp=120, coins=500, harvests=4)
        expanded["unlockedPlots"] = 9
        expanded["plots"] = [
            {
                "id": i,
                "crop": None,
                "plantedDay": None,
                "growth": 0,
                "watered": False,
                "health": 100,
                "ready": False,
            }
            for i in range(1, 13)
        ]
        parsed = farm.FarmStateInput(**expanded)
        self.assertEqual(parsed.unlockedPlots, 9)
        self.assertEqual(len(parsed.plots), 12)

        bad = dict(expanded)
        bad["unlockedPlots"] = 8
        with self.assertRaises(ValidationError):
            farm.FarmStateInput(**bad)

    def test_inventory_and_fulfilled_orders_are_validated(self):
        value = state(day=6, xp=120, coins=400, harvests=5)
        value["inventory"] = {
            "wheat": 2, "corn": 1, "tomato": 0, "carrot": 3,
            "eggs": 4, "milk": 1, "wool": 0,
        }
        value["fulfilledOrders"] = ["order-6-0", "order-6-2"]
        value["completedOrders"] = 2
        parsed = farm.FarmStateInput(**value)
        self.assertEqual(parsed.inventory.wheat, 2)
        self.assertEqual(parsed.completedOrders, 2)
        self.assertEqual(parsed.fulfilledOrders, ["order-6-0", "order-6-2"])

        duplicate = dict(value)
        duplicate["fulfilledOrders"] = ["order-6-0", "order-6-0"]
        with self.assertRaises(ValidationError):
            farm.FarmStateInput(**duplicate)

        invalid = dict(value)
        invalid["fulfilledOrders"] = ["bad-order"]
        with self.assertRaises(ValidationError):
            farm.FarmStateInput(**invalid)

    def test_order_streak_fields_are_validated(self):
        value = state(day=8, xp=160, coins=500, harvests=6)
        value["orderStreak"] = 3
        value["lastOrderStreakDay"] = 7
        parsed = farm.FarmStateInput(**value)
        self.assertEqual(parsed.orderStreak, 3)
        self.assertEqual(parsed.lastOrderStreakDay, 7)

        bad = dict(value)
        bad["orderStreak"] = 31
        with self.assertRaises(ValidationError):
            farm.FarmStateInput(**bad)

        future = dict(value)
        future["lastOrderStreakDay"] = 9
        with self.assertRaises(ValidationError):
            farm.FarmStateInput(**future)

    def test_server_accepts_virtual_gameplay_state_but_no_wallet_fields(self):
        payload = farm.FarmStateInput(**state(day=4, xp=90, coins=123, harvests=3))
        saved = asyncio.run(farm.save_farm_progress(
            farm.FarmSaveInput(revision=0, state=payload),
            None,
        ))
        self.assertEqual(saved["state"]["coins"], 123)
        for forbidden in ("wallet", "eur", "balance", "payment", "payout", "purchase"):
            self.assertNotIn(forbidden, saved["state"])


if __name__ == "__main__":
    unittest.main()
