"""Server-replayed score integrity for first-party BidBlitz Games.

Runner sessions receive a server-issued seed. A completed run can be accepted
only when the server can replay every lane action and reproduce a winning
result. This proves internal score consistency, not that a human physically
performed the actions; public trusted leaderboards remain disabled.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from core.database import db
from core.security import get_current_user


router = APIRouter(prefix="/api/games/integrity", tags=["games-integrity"])

_RUNNER_LEVELS = 15
_RUNNER_LANES = 3
_SESSION_TTL_MINUTES = 30
_U32 = 0xFFFFFFFF

Action = Annotated[int, Field(strict=True, ge=-1, le=1)]


class RunnerSessionInput(BaseModel):
    level: int = Field(strict=True, ge=1, le=_RUNNER_LEVELS)


class RunnerVerifyInput(BaseModel):
    session_id: str = Field(min_length=32, max_length=32)
    actions: list[Action] = Field(min_length=1, max_length=60)

    @field_validator("session_id", mode="before")
    @classmethod
    def normalize_session_id(cls, value):
        value = str(value or "").strip().lower()
        if len(value) != 32 or any(ch not in "0123456789abcdef" for ch in value):
            raise ValueError("Ungültige Session-ID")
        return value

    @field_validator("actions")
    @classmethod
    def validate_actions(cls, values):
        if any(type(value) is not int or value not in {-1, 0, 1} for value in values):
            raise ValueError("Ungültige Runner-Aktion")
        return values


async def _owner(request: Request) -> str:
    user = await get_current_user(request)
    return str(user["_id"])


def _runner_spec(level: int) -> dict:
    index = level - 1
    return {
        "distance": 24 + index * 2,
        "star_target": 7 + index // 2,
    }


def _random_u32(state: int) -> tuple[int, float]:
    x = state & _U32
    x ^= (x << 13) & _U32
    x ^= x >> 17
    x ^= (x << 5) & _U32
    x &= _U32
    return x, x / 4294967296


def _runner_course(level: int, seed: int) -> list[dict]:
    spec = _runner_spec(level)
    state = seed & _U32 or 123456
    course = []
    previous_obstacle = -1

    for _ in range(spec["distance"]):
        state, value = _random_u32(state)
        if value < 0.72:
            state, lane_value = _random_u32(state)
            obstacle = int(lane_value * _RUNNER_LANES)
        else:
            obstacle = -1

        if obstacle == previous_obstacle:
            state, repeat_value = _random_u32(state)
            if repeat_value < 0.55:
                state, shift_value = _random_u32(state)
                obstacle = (obstacle + 1 + int(shift_value * 2)) % _RUNNER_LANES

        previous_obstacle = obstacle
        safe_lanes = [lane for lane in range(_RUNNER_LANES) if lane != obstacle]

        state, shard_chance = _random_u32(state)
        if shard_chance < 0.84:
            state, shard_value = _random_u32(state)
            shard = safe_lanes[int(shard_value * len(safe_lanes))]
        else:
            shard = -1

        course.append({"obstacle": obstacle, "shard": shard})

    return course


def replay_runner(level: int, seed: int, actions: list[int]) -> dict:
    spec = _runner_spec(level)
    if len(actions) != spec["distance"]:
        raise ValueError("Runner-Aktionszahl passt nicht zur Strecke")

    course = _runner_course(level, seed)
    lane = 1
    score = 0
    shards = 0
    turns = 0

    for position, direction in enumerate(actions):
        if type(direction) is not int or direction not in {-1, 0, 1}:
            raise ValueError("Ungültige Runner-Aktion")
        lane = max(0, min(_RUNNER_LANES - 1, lane + direction))
        turns += 1
        segment = course[position]
        if segment["obstacle"] == lane:
            return {
                "status": "lost",
                "level": level,
                "score": score,
                "shards": shards,
                "stars": 0,
                "turns": turns,
                "position": position,
            }
        if segment["shard"] == lane:
            shards += 1
            score += 100
        score += 10

    target = spec["star_target"]
    stars = 3 if shards >= -(-target * 3 // 2) else 2 if shards >= target else 1
    return {
        "status": "won",
        "level": level,
        "score": score,
        "shards": shards,
        "stars": stars,
        "turns": turns,
        "position": spec["distance"],
    }


def _verified_default() -> dict:
    return {
        "version": 1,
        "best": [0] * _RUNNER_LEVELS,
        "stars": [0] * _RUNNER_LEVELS,
        "verified_levels": 0,
        "updated_at": None,
        "integrity": "server_replayed_not_full_anti_cheat",
    }


def _verified_public(doc: dict | None) -> dict:
    if not doc:
        return _verified_default()
    best = doc.get("best") if isinstance(doc.get("best"), list) and len(doc["best"]) == _RUNNER_LEVELS else [0] * _RUNNER_LEVELS
    stars = doc.get("stars") if isinstance(doc.get("stars"), list) and len(doc["stars"]) == _RUNNER_LEVELS else [0] * _RUNNER_LEVELS
    safe_best = [value if type(value) is int and 0 <= value <= 1_000_000_000 else 0 for value in best]
    safe_stars = [value if type(value) is int and 0 <= value <= 3 else 0 for value in stars]
    return {
        "version": 1,
        "best": safe_best,
        "stars": safe_stars,
        "verified_levels": sum(1 for value in safe_best if value > 0),
        "updated_at": doc.get("updated_at"),
        "integrity": "server_replayed_not_full_anti_cheat",
    }


@router.post("/runner/sessions")
async def create_runner_integrity_session(body: RunnerSessionInput, request: Request):
    owner_id = await _owner(request)
    progress = await db.games_runner_progress.find_one(
        {"owner_id": owner_id},
        {"_id": 0, "unlocked": 1},
    )
    unlocked = max(1, min(_RUNNER_LEVELS, int((progress or {}).get("unlocked") or 1)))
    if body.level > unlocked:
        raise HTTPException(409, "Dieses Runner-Level ist noch nicht freigeschaltet")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=_SESSION_TTL_MINUTES)
    seed = secrets.randbits(32) or 123456
    session_id = secrets.token_hex(16)
    await db.games_integrity_sessions.insert_one({
        "_id": session_id,
        "owner_id": owner_id,
        "game_id": "runner",
        "level": body.level,
        "seed": seed,
        "used": False,
        "created_at": now,
        "expires_at": expires_at,
    })
    return {
        "session_id": session_id,
        "game_id": "runner",
        "level": body.level,
        "seed": seed,
        "expires_at": expires_at.isoformat(),
        "score_verification": "server_replay_required",
    }


@router.post("/runner/verify")
async def verify_runner_integrity(body: RunnerVerifyInput, request: Request):
    owner_id = await _owner(request)
    now = datetime.now(timezone.utc)
    session = await db.games_integrity_sessions.find_one({
        "_id": body.session_id,
        "owner_id": owner_id,
        "game_id": "runner",
        "used": False,
    })
    if not session:
        raise HTTPException(404, "Runner-Verifikationssession nicht gefunden")
    expires_at = session.get("expires_at")
    if not isinstance(expires_at, datetime) or expires_at <= now:
        raise HTTPException(410, "Runner-Verifikationssession ist abgelaufen")

    level = int(session.get("level") or 0)
    seed = int(session.get("seed") or 0)
    try:
        result = replay_runner(level, seed, body.actions)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if result["status"] != "won":
        raise HTTPException(422, "Runner-Lauf konnte serverseitig nicht als gewonnen bestätigt werden")

    consumed = await db.games_integrity_sessions.update_one(
        {
            "_id": body.session_id,
            "owner_id": owner_id,
            "game_id": "runner",
            "used": False,
            "expires_at": {"$gt": now},
        },
        {"$set": {"used": True, "used_at": now}},
    )
    if not getattr(consumed, "matched_count", 0):
        raise HTTPException(409, "Runner-Verifikationssession wurde bereits verwendet")

    index = level - 1
    timestamp = now.isoformat()
    await db.games_runner_verified_progress.update_one(
        {"owner_id": owner_id},
        {
            "$setOnInsert": {
                "owner_id": owner_id,
                "version": 1,
                "best": [0] * _RUNNER_LEVELS,
                "stars": [0] * _RUNNER_LEVELS,
                "created_at": timestamp,
            },
            "$max": {
                f"best.{index}": result["score"],
                f"stars.{index}": result["stars"],
            },
            "$set": {"updated_at": timestamp},
        },
        upsert=True,
    )

    return {
        **result,
        "verified": True,
        "integrity": "server_replayed_not_full_anti_cheat",
        "public_trusted_leaderboard_enabled": False,
    }


@router.get("/runner/me")
async def get_runner_verified_progress(request: Request):
    owner_id = await _owner(request)
    doc = await db.games_runner_verified_progress.find_one(
        {"owner_id": owner_id},
        {"_id": 0, "owner_id": 0},
    )
    return _verified_public(doc)



# Bubble Islands server replay -------------------------------------------------

_BUBBLE_LEVELS = 20
_BUBBLE_ROWS = 7
_BUBBLE_COLS = 7
_BUBBLE_SIZE = _BUBBLE_ROWS * _BUBBLE_COLS
_BUBBLE_COLORS = 5

BubbleAction = Annotated[int, Field(strict=True, ge=0, le=_BUBBLE_SIZE - 1)]


class BubbleSessionInput(BaseModel):
    level: int = Field(strict=True, ge=1, le=_BUBBLE_LEVELS)


class BubbleVerifyInput(BaseModel):
    session_id: str = Field(min_length=32, max_length=32)
    actions: list[BubbleAction] = Field(min_length=1, max_length=30)

    @field_validator("session_id", mode="before")
    @classmethod
    def normalize_bubble_session_id(cls, value):
        value = str(value or "").strip().lower()
        if len(value) != 32 or any(ch not in "0123456789abcdef" for ch in value):
            raise ValueError("Ungültige Session-ID")
        return value

    @field_validator("actions")
    @classmethod
    def validate_bubble_actions(cls, values):
        if any(type(value) is not int or value < 0 or value >= _BUBBLE_SIZE for value in values):
            raise ValueError("Ungültige Bubble-Aktion")
        return values


def _bubble_spec(level: int) -> dict:
    index = level - 1
    return {
        "moves": 18 + (index // 5) * 2,
        "target": 800 + index * 140,
    }


def _bubble_neighbours(index: int) -> list[int]:
    row, col = divmod(index, _BUBBLE_COLS)
    result = []
    if row > 0:
        result.append(index - _BUBBLE_COLS)
    if row < _BUBBLE_ROWS - 1:
        result.append(index + _BUBBLE_COLS)
    if col > 0:
        result.append(index - 1)
    if col < _BUBBLE_COLS - 1:
        result.append(index + 1)
    return result


def _bubble_group(board: list[int], start: int) -> list[int]:
    if start < 0 or start >= _BUBBLE_SIZE:
        return []
    color = board[start]
    if type(color) is not int or color < 0 or color >= _BUBBLE_COLORS:
        return []
    seen = {start}
    queue = [start]
    cursor = 0
    while cursor < len(queue):
        for nxt in _bubble_neighbours(queue[cursor]):
            if nxt not in seen and board[nxt] == color:
                seen.add(nxt)
                queue.append(nxt)
        cursor += 1
    return queue


def _bubble_groups(board: list[int]) -> list[list[int]]:
    found = []
    seen = set()
    for index in range(_BUBBLE_SIZE):
        if index in seen or board[index] < 0:
            continue
        cells = _bubble_group(board, index)
        seen.update(cells)
        if len(cells) >= 2:
            found.append(cells)
    return found


def _bubble_generate(seed: int) -> list[int]:
    state = seed & _U32 or 123456
    for _ in range(100):
        board = []
        for _ in range(_BUBBLE_SIZE):
            state, value = _random_u32(state)
            board.append(int(value * _BUBBLE_COLORS))
        if _bubble_groups(board):
            return board
    raise ValueError("Kein spielbares Bubble-Feld erzeugt")


def _bubble_collapse(board: list[int]) -> list[int]:
    nxt = list(board)
    for col in range(_BUBBLE_COLS):
        values = []
        for row in range(_BUBBLE_ROWS - 1, -1, -1):
            value = nxt[row * _BUBBLE_COLS + col]
            if value >= 0:
                values.append(value)
        cursor = 0
        for row in range(_BUBBLE_ROWS - 1, -1, -1):
            nxt[row * _BUBBLE_COLS + col] = values[cursor] if cursor < len(values) else -1
            cursor += 1

    columns = []
    for col in range(_BUBBLE_COLS):
        values = [nxt[row * _BUBBLE_COLS + col] for row in range(_BUBBLE_ROWS)]
        if any(value >= 0 for value in values):
            columns.append(values)
    while len(columns) < _BUBBLE_COLS:
        columns.append([-1] * _BUBBLE_ROWS)

    compact = [-1] * _BUBBLE_SIZE
    for col in range(_BUBBLE_COLS):
        for row in range(_BUBBLE_ROWS):
            compact[row * _BUBBLE_COLS + col] = columns[col][row]
    return compact


def _bubble_stars(level: int, score: int) -> int:
    target = _bubble_spec(level)["target"]
    if score < target:
        return 0
    if score * 10 >= target * 18:
        return 3
    if score * 100 >= target * 135:
        return 2
    return 1


def replay_bubble(level: int, seed: int, actions: list[int]) -> dict:
    spec = _bubble_spec(level)
    board = _bubble_generate(seed)
    moves = spec["moves"]
    score = 0
    turns = 0
    status = "playing"

    for index in actions:
        if status != "playing":
            raise ValueError("Bubble-Aktionen nach Rundenende sind nicht erlaubt")
        if type(index) is not int or index < 0 or index >= _BUBBLE_SIZE:
            raise ValueError("Ungültige Bubble-Aktion")
        cells = _bubble_group(board, index)
        if len(cells) < 2:
            raise ValueError("Bubble-Aktion entfernt keine gültige Gruppe")
        for cell in cells:
            board[cell] = -1
        board = _bubble_collapse(board)
        moves -= 1
        turns += 1
        score += len(cells) * len(cells) * 10

        if score >= spec["target"]:
            status = "won"
        elif moves <= 0 or not _bubble_groups(board):
            status = "lost"

    return {
        "status": status,
        "level": level,
        "score": score,
        "stars": _bubble_stars(level, score),
        "turns": turns,
        "moves": moves,
    }


def _bubble_verified_public(doc: dict | None) -> dict:
    if not doc:
        return {
            "version": 1,
            "best": [0] * _BUBBLE_LEVELS,
            "stars": [0] * _BUBBLE_LEVELS,
            "verified_levels": 0,
            "updated_at": None,
            "integrity": "server_replayed_not_full_anti_cheat",
        }
    best = doc.get("best") if isinstance(doc.get("best"), list) and len(doc["best"]) == _BUBBLE_LEVELS else [0] * _BUBBLE_LEVELS
    stars = doc.get("stars") if isinstance(doc.get("stars"), list) and len(doc["stars"]) == _BUBBLE_LEVELS else [0] * _BUBBLE_LEVELS
    safe_best = [value if type(value) is int and 0 <= value <= 1_000_000_000 else 0 for value in best]
    safe_stars = [value if type(value) is int and 0 <= value <= 3 else 0 for value in stars]
    return {
        "version": 1,
        "best": safe_best,
        "stars": safe_stars,
        "verified_levels": sum(1 for value in safe_best if value > 0),
        "updated_at": doc.get("updated_at"),
        "integrity": "server_replayed_not_full_anti_cheat",
    }


@router.post("/bubble/sessions")
async def create_bubble_integrity_session(body: BubbleSessionInput, request: Request):
    owner_id = await _owner(request)
    progress = await db.games_bubble_progress.find_one(
        {"owner_id": owner_id},
        {"_id": 0, "unlocked": 1},
    )
    unlocked = max(1, min(_BUBBLE_LEVELS, int((progress or {}).get("unlocked") or 1)))
    if body.level > unlocked:
        raise HTTPException(409, "Dieses Bubble-Level ist noch nicht freigeschaltet")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=_SESSION_TTL_MINUTES)
    seed = secrets.randbits(32) or 123456
    session_id = secrets.token_hex(16)
    await db.games_integrity_sessions.insert_one({
        "_id": session_id,
        "owner_id": owner_id,
        "game_id": "bubble",
        "level": body.level,
        "seed": seed,
        "used": False,
        "created_at": now,
        "expires_at": expires_at,
    })
    return {
        "session_id": session_id,
        "game_id": "bubble",
        "level": body.level,
        "seed": seed,
        "expires_at": expires_at.isoformat(),
        "score_verification": "server_replay_required",
    }


@router.post("/bubble/verify")
async def verify_bubble_integrity(body: BubbleVerifyInput, request: Request):
    owner_id = await _owner(request)
    now = datetime.now(timezone.utc)
    session = await db.games_integrity_sessions.find_one({
        "_id": body.session_id,
        "owner_id": owner_id,
        "game_id": "bubble",
        "used": False,
    })
    if not session:
        raise HTTPException(404, "Bubble-Verifikationssession nicht gefunden")
    expires_at = session.get("expires_at")
    if not isinstance(expires_at, datetime) or expires_at <= now:
        raise HTTPException(410, "Bubble-Verifikationssession ist abgelaufen")

    level = int(session.get("level") or 0)
    seed = int(session.get("seed") or 0)
    try:
        result = replay_bubble(level, seed, body.actions)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if result["status"] != "won":
        raise HTTPException(422, "Bubble-Runde konnte serverseitig nicht als gewonnen bestätigt werden")

    consumed = await db.games_integrity_sessions.update_one(
        {
            "_id": body.session_id,
            "owner_id": owner_id,
            "game_id": "bubble",
            "used": False,
            "expires_at": {"$gt": now},
        },
        {"$set": {"used": True, "used_at": now}},
    )
    if not getattr(consumed, "matched_count", 0):
        raise HTTPException(409, "Bubble-Verifikationssession wurde bereits verwendet")

    index = level - 1
    timestamp = now.isoformat()
    await db.games_bubble_verified_progress.update_one(
        {"owner_id": owner_id},
        {
            "$setOnInsert": {
                "owner_id": owner_id,
                "version": 1,
                "best": [0] * _BUBBLE_LEVELS,
                "stars": [0] * _BUBBLE_LEVELS,
                "created_at": timestamp,
            },
            "$max": {
                f"best.{index}": result["score"],
                f"stars.{index}": result["stars"],
            },
            "$set": {"updated_at": timestamp},
        },
        upsert=True,
    )
    return {
        **result,
        "verified": True,
        "integrity": "server_replayed_not_full_anti_cheat",
        "public_trusted_leaderboard_enabled": False,
    }


@router.get("/bubble/me")
async def get_bubble_verified_progress(request: Request):
    owner_id = await _owner(request)
    doc = await db.games_bubble_verified_progress.find_one(
        {"owner_id": owner_id},
        {"_id": 0, "owner_id": 0},
    )
    return _bubble_verified_public(doc)
