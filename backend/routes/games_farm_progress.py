"""Account-backed BidBlitz Farm snapshot sync.

This stores gameplay-only Farm state. Farm coins are virtual and have no wallet,
cash, payout, purchase or settlement meaning.
"""

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator, model_validator

from core.database import db
from core.security import get_current_user


router = APIRouter(prefix="/api/games/progress/farm", tags=["games-farm-progress"])

CROPS = {"wheat", "corn", "tomato", "carrot"}
WEATHER = {"sunny", "cloudy", "rain", "storm"}
PLOT_COUNT = 6
MAX_PLOTS = 12
ANIMAL_BUILDING = {"chicken": "coop", "cow": "barn", "sheep": "barn"}
ANIMAL_PRODUCE_DAYS = {"chicken": 1, "cow": 2, "sheep": 2}
BUILDING_MAX_LEVEL = {"coop": 5, "barn": 5, "silo": 5}
MISSION_IDS = {"harvest-5", "animals-3", "buildings-5", "farm-level-5", "orders-10", "land-12", "buildings-9", "farm-level-10"}
INVENTORY_IDS = {"wheat", "corn", "tomato", "carrot", "eggs", "milk", "wool"}
LEVEL_REWARD_LEVELS = {5, 10, 20, 30, 40, 50}


def _xorshift(value: int) -> int:
    value &= 0xFFFFFFFF
    value ^= (value << 13) & 0xFFFFFFFF
    value ^= value >> 17
    value ^= (value << 5) & 0xFFFFFFFF
    return value & 0xFFFFFFFF or 2463534242


def _season_for_day(day: int) -> int:
    return ((day - 1) // 7) % 4


def _weather_for(seed: int, day: int, season: int) -> str:
    rng = (seed ^ ((day * 2654435761) & 0xFFFFFFFF) ^ ((season * 2246822519) & 0xFFFFFFFF)) & 0xFFFFFFFF
    rng = _xorshift(rng)
    roll = rng / 4294967296
    if season == 1:
        return "sunny" if roll < .48 else "cloudy" if roll < .70 else "rain" if roll < .92 else "storm"
    if season == 3:
        return "sunny" if roll < .20 else "cloudy" if roll < .55 else "rain" if roll < .88 else "storm"
    return "sunny" if roll < .30 else "cloudy" if roll < .52 else "rain" if roll < .90 else "storm"


def _level_from_xp(xp: int) -> int:
    return min(50, 1 + max(0, xp) // 40)


class FarmPlotInput(BaseModel):
    id: int = Field(strict=True, ge=1, le=MAX_PLOTS)
    crop: Literal["wheat", "corn", "tomato", "carrot"] | None = None
    plantedDay: int | None = Field(default=None, ge=1, le=100000, strict=True)
    growth: float = Field(ge=0, le=1000)
    watered: bool
    health: int = Field(strict=True, ge=0, le=100)
    ready: bool


class FarmAnimalInput(BaseModel):
    count: int = Field(strict=True, ge=0, le=100)
    fed: bool = False
    progress: int = Field(strict=True, ge=0, le=10)
    ready: int = Field(strict=True, ge=0, le=100000)


class FarmAnimalsInput(BaseModel):
    chicken: FarmAnimalInput = Field(default_factory=lambda: FarmAnimalInput(count=0, fed=False, progress=0, ready=0))
    cow: FarmAnimalInput = Field(default_factory=lambda: FarmAnimalInput(count=0, fed=False, progress=0, ready=0))
    sheep: FarmAnimalInput = Field(default_factory=lambda: FarmAnimalInput(count=0, fed=False, progress=0, ready=0))


class FarmInventoryInput(BaseModel):
    wheat: int = Field(default=0, strict=True, ge=0, le=1_000_000)
    corn: int = Field(default=0, strict=True, ge=0, le=1_000_000)
    tomato: int = Field(default=0, strict=True, ge=0, le=1_000_000)
    carrot: int = Field(default=0, strict=True, ge=0, le=1_000_000)
    eggs: int = Field(default=0, strict=True, ge=0, le=1_000_000)
    milk: int = Field(default=0, strict=True, ge=0, le=1_000_000)
    wool: int = Field(default=0, strict=True, ge=0, le=1_000_000)


class FarmBuildingsInput(BaseModel):
    coop: int = Field(default=1, strict=True, ge=1, le=5)
    barn: int = Field(default=1, strict=True, ge=1, le=5)
    silo: int = Field(default=1, strict=True, ge=1, le=5)


class FarmStateInput(BaseModel):
    version: Literal[1] = 1
    seed: int = Field(strict=True, ge=1, le=4294967295)
    day: int = Field(strict=True, ge=1, le=100000)
    season: int = Field(strict=True, ge=0, le=3)
    weather: Literal["sunny", "cloudy", "rain", "storm"]
    coins: int = Field(strict=True, ge=0, le=1_000_000_000)
    xp: int = Field(strict=True, ge=0, le=1_000_000_000)
    level: int = Field(strict=True, ge=1, le=50)
    harvests: int = Field(strict=True, ge=0, le=1_000_000_000)
    unlockedPlots: int = Field(default=PLOT_COUNT, strict=True)
    animals: FarmAnimalsInput = Field(default_factory=FarmAnimalsInput)
    buildings: FarmBuildingsInput = Field(default_factory=FarmBuildingsInput)
    inventory: FarmInventoryInput = Field(default_factory=FarmInventoryInput)
    fulfilledOrders: list[str] = Field(default_factory=list, max_length=90)
    completedOrders: int = Field(default=0, strict=True, ge=0, le=1_000_000)
    orderStreak: int = Field(default=0, strict=True, ge=0, le=30)
    lastOrderStreakDay: int = Field(default=0, strict=True, ge=0, le=100000)
    claimedMissions: list[str] = Field(default_factory=list, max_length=20)
    claimedLevelRewards: list[int] = Field(default_factory=list, max_length=6)
    plots: list[FarmPlotInput] = Field(min_length=PLOT_COUNT, max_length=MAX_PLOTS)
    lastEvent: str = Field(default="", max_length=160)

    @field_validator("fulfilledOrders")
    @classmethod
    def validate_orders(cls, values: list[str]) -> list[str]:
        if len(values) != len(set(values)):
            raise ValueError("Doppelte Farm-Bestellungen")
        for value in values:
            if not isinstance(value, str) or not value.startswith("order-"):
                raise ValueError("Ungültige Farm-Bestellung")
            parts = value.split("-")
            if len(parts) != 3 or not parts[1].isdigit() or parts[2] not in {"0", "1", "2"}:
                raise ValueError("Ungültige Farm-Bestellung")
        return values

    @field_validator("claimedLevelRewards")
    @classmethod
    def validate_level_rewards(cls, values: list[int]) -> list[int]:
        if len(values) != len(set(values)) or any(value not in LEVEL_REWARD_LEVELS for value in values):
            raise ValueError("Ungültige Farm-Level-Belohnungen")
        return values

    @field_validator("claimedMissions")
    @classmethod
    def validate_missions(cls, values: list[str]) -> list[str]:
        if len(values) != len(set(values)) or any(value not in MISSION_IDS for value in values):
            raise ValueError("Ungültige Farm-Missionen")
        return values

    @model_validator(mode="after")
    def validate_snapshot(self):
        if self.season != _season_for_day(self.day):
            raise ValueError("Ungültige Saison für diesen Farm-Tag")
        if self.weather != _weather_for(self.seed, self.day, self.season):
            raise ValueError("Ungültiges Wetter für diesen Farm-Tag")
        if self.level != _level_from_xp(self.xp):
            raise ValueError("Farm-Level passt nicht zu XP")
        if any(level > self.level for level in self.claimedLevelRewards):
            raise ValueError("Level-Belohnung wurde zu früh eingelöst")
        if self.lastOrderStreakDay > self.day:
            raise ValueError("Ungültiger Auftragstag")
        if any(int(order.split("-")[1]) > self.day for order in self.fulfilledOrders):
            raise ValueError("Farm-Bestellung liegt in der Zukunft")
        if self.unlockedPlots not in {6, 9, 12}:
            raise ValueError("Ungültige Anzahl freigeschalteter Farm-Felder")
        if len(self.plots) not in {PLOT_COUNT, MAX_PLOTS}:
            raise ValueError("Farm-Felder sind unvollständig")
        if len(self.plots) == PLOT_COUNT:
            self.plots.extend([
                FarmPlotInput(id=index, crop=None, plantedDay=None, growth=0, watered=False, health=100, ready=False)
                for index in range(PLOT_COUNT + 1, MAX_PLOTS + 1)
            ])
        ids = [plot.id for plot in self.plots]
        if ids != list(range(1, MAX_PLOTS + 1)):
            raise ValueError("Farm-Felder sind unvollständig oder falsch sortiert")
        for animal_id, building_id in ANIMAL_BUILDING.items():
            herd = getattr(self.animals, animal_id)
            building_level = getattr(self.buildings, building_id)
            if herd.count > building_level * 3:
                raise ValueError("Tierbestand überschreitet Gebäudekapazität")
            if herd.progress > ANIMAL_PRODUCE_DAYS[animal_id]:
                raise ValueError("Ungültiger Tier-Produktionsfortschritt")
        for building_id, max_level in BUILDING_MAX_LEVEL.items():
            if getattr(self.buildings, building_id) > max_level:
                raise ValueError("Ungültiges Gebäude-Level")
        for plot in self.plots:
            if plot.crop is None:
                if plot.plantedDay is not None or plot.growth != 0 or plot.ready:
                    raise ValueError("Leeres Feld enthält ungültige Pflanzendaten")
            else:
                if plot.plantedDay is None or plot.plantedDay > self.day:
                    raise ValueError("Ungültiger Pflanztag")
        return self


class FarmSaveInput(BaseModel):
    revision: int = Field(strict=True, ge=0, le=1_000_000_000)
    state: FarmStateInput


async def _owner(request: Request) -> str:
    user = await get_current_user(request)
    return str(user["_id"])


def _public(doc: dict | None) -> dict:
    if not doc:
        return {"exists": False, "revision": 0, "state": None, "updated_at": None}
    return {
        "exists": True,
        "revision": int(doc.get("revision") or 0),
        "state": doc.get("state"),
        "updated_at": doc.get("updated_at"),
    }


@router.get("")
async def get_farm_progress(request: Request):
    owner_id = await _owner(request)
    doc = await db.games_farm_progress.find_one({"owner_id": owner_id}, {"_id": 0, "owner_id": 0})
    return _public(doc)


@router.put("")
async def save_farm_progress(body: FarmSaveInput, request: Request):
    owner_id = await _owner(request)
    now = datetime.now(timezone.utc).isoformat()
    state = body.state.model_dump()

    if body.revision == 0:
        doc = {
            "owner_id": owner_id,
            "revision": 1,
            "state": state,
            "created_at": now,
            "updated_at": now,
        }
        try:
            await db.games_farm_progress.insert_one(doc)
            return _public(doc)
        except Exception as exc:
            if getattr(exc, "code", None) != 11000 and exc.__class__.__name__ != "DuplicateKeyError":
                raise
    else:
        result = await db.games_farm_progress.update_one(
            {"owner_id": owner_id, "revision": body.revision},
            {
                "$set": {"state": state, "updated_at": now},
                "$inc": {"revision": 1},
            },
        )
        if getattr(result, "matched_count", 0):
            saved = await db.games_farm_progress.find_one({"owner_id": owner_id}, {"_id": 0, "owner_id": 0})
            return _public(saved)

    current = await db.games_farm_progress.find_one({"owner_id": owner_id}, {"_id": 0, "owner_id": 0})
    raise HTTPException(
        status_code=409,
        detail={"code": "farm_revision_conflict", "current": _public(current)},
    )
