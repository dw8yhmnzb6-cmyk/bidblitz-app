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



# BidBlitz Match server replay -------------------------------------------------

_MATCH_LEVELS = 30
_MATCH_SIZE = 8
_MATCH_CELLS = 64
_MATCH_TYPES = 6


class MatchSessionInput(BaseModel):
    level: int = Field(strict=True, ge=1, le=_MATCH_LEVELS)


class MatchSwapInput(BaseModel):
    a: int = Field(strict=True, ge=0, le=_MATCH_CELLS - 1)
    b: int = Field(strict=True, ge=0, le=_MATCH_CELLS - 1)


class MatchVerifyInput(BaseModel):
    session_id: str = Field(min_length=32, max_length=32)
    actions: list[MatchSwapInput] = Field(min_length=1, max_length=80)

    @field_validator("session_id", mode="before")
    @classmethod
    def normalize_match_session_id(cls, value):
        value = str(value or "").strip().lower()
        if len(value) != 32 or any(ch not in "0123456789abcdef" for ch in value):
            raise ValueError("Ungültige Session-ID")
        return value


def _match_spec(level: int) -> dict:
    index = level - 1
    return {
        "moves": 23 + (index // 10) * 3,
        "target": 650 + index * 95,
        "blue": 0 if index < 10 else 8 + ((index - 10) // 2),
        "ice": 0 if index < 20 else 8 + (index - 20) * 2,
    }


def _match_random(state: int) -> tuple[int, float]:
    return _random_u32(state)


def _match_kind(value: int) -> int:
    return value // _MATCH_TYPES


def _match_color(value: int) -> int:
    return -1 if _match_kind(value) == 4 else value % _MATCH_TYPES


def _match_groups(board: list[int]) -> list[dict]:
    result = []
    for axis in range(2):
        for line in range(_MATCH_SIZE):
            run = []
            for pos in range(_MATCH_SIZE + 1):
                at = pos * _MATCH_SIZE + line if axis else line * _MATCH_SIZE + pos
                if pos < _MATCH_SIZE and (
                    not run or (
                        _match_color(board[at]) >= 0
                        and _match_color(board[at]) == _match_color(board[run[0]])
                    )
                ):
                    run.append(at)
                else:
                    if len(run) >= 3:
                        result.append({"cells": list(run), "axis": axis})
                    run = [at] if pos < _MATCH_SIZE else []
    return result


def _match_adjacent(a: int, b: int) -> bool:
    return (
        type(a) is int and type(b) is int
        and 0 <= a < _MATCH_CELLS and 0 <= b < _MATCH_CELLS
        and abs(a % _MATCH_SIZE - b % _MATCH_SIZE)
        + abs(a // _MATCH_SIZE - b // _MATCH_SIZE) == 1
    )


def _match_legal(board: list[int], a: int, b: int) -> bool:
    if not _match_adjacent(a, b):
        return False
    if (
        _match_kind(board[a]) == 4
        or _match_kind(board[b]) == 4
        or (_match_kind(board[a]) and _match_kind(board[b]))
    ):
        return True
    nxt = list(board)
    nxt[a], nxt[b] = nxt[b], nxt[a]
    return any(a in group["cells"] or b in group["cells"] for group in _match_groups(nxt))


def _match_hint(board: list[int]) -> tuple[int, int] | None:
    for index in range(_MATCH_CELLS):
        for other in (index + 1, index + _MATCH_SIZE):
            if _match_legal(board, index, other):
                return index, other
    return None


def _match_generate(rng: int) -> tuple[int, list[int]]:
    state = rng
    for _ in range(80):
        board = []
        for index in range(_MATCH_CELLS):
            forbidden = set()
            if index % _MATCH_SIZE > 1 and board[index - 1] == board[index - 2]:
                forbidden.add(board[index - 1])
            if index >= _MATCH_SIZE * 2 and board[index - _MATCH_SIZE] == board[index - _MATCH_SIZE * 2]:
                forbidden.add(board[index - _MATCH_SIZE])
            choices = [value for value in range(_MATCH_TYPES) if value not in forbidden]
            state, random_value = _match_random(state)
            board.append(choices[int(random_value * len(choices))])
        if _match_hint(board):
            return state, board
    raise ValueError("Kein spielbares Match-Feld erzeugt")


def _match_create(level: int, seed: int) -> dict:
    if level < 1 or level > _MATCH_LEVELS:
        raise ValueError("Ungültiges Match-Level")
    spec = _match_spec(level)
    rng = seed & _U32 or 123456
    rng, board = _match_generate(rng)
    cells = list(range(_MATCH_CELLS))
    ice = []
    for _ in range(spec["ice"]):
        rng, value = _match_random(rng)
        ice.append(cells.pop(int(value * len(cells))))
    return {
        "level": level,
        "rng": rng,
        "moves": spec["moves"],
        "score": 0,
        "blue": 0,
        "ice": ice,
        "status": "playing",
        "turns": 0,
        "board": board,
    }


def _match_creations(board: list[int], matches: list[dict], preferred: list[int]) -> list[dict]:
    clusters = []
    for group in matches:
        touching = [cluster for cluster in clusters if any(cell in cluster["cells"] for cell in group["cells"])]
        cluster = {"cells": set(group["cells"]), "groups": [group]}
        for old in touching:
            cluster["cells"].update(old["cells"])
            cluster["groups"].extend(old["groups"])
            clusters.remove(old)
        clusters.append(cluster)

    result = []
    for cluster in clusters:
        long_group = next((g for g in cluster["groups"] if len(g["cells"]) >= 5), None)
        cross = (
            any(g["axis"] == 0 for g in cluster["groups"])
            and any(g["axis"] == 1 for g in cluster["groups"])
        )
        four = next((g for g in cluster["groups"] if len(g["cells"]) == 4), None)
        special_type = 4 if long_group else 3 if cross else (2 if four and four["axis"] else 1) if four else 0
        if not special_type:
            continue
        eligible = [cell for cell in cluster["cells"] if not _match_kind(board[cell])]
        at = next((cell for cell in preferred if cell in eligible), eligible[0] if eligible else None)
        if at is None:
            continue
        value = 24 if special_type == 4 else special_type * _MATCH_TYPES + _match_color(board[at])
        result.append({"at": at, "value": value})
    return result


def _match_effect(board: list[int], at: int) -> list[int]:
    result = []
    row, col = divmod(at, _MATCH_SIZE)
    special_type = _match_kind(board[at])
    for index in range(_MATCH_CELLS):
        r, c = divmod(index, _MATCH_SIZE)
        if (
            (special_type == 1 and r == row)
            or (special_type == 2 and c == col)
            or (special_type == 3 and abs(r - row) <= 1 and abs(c - col) <= 1)
        ):
            result.append(index)
    if special_type == 4:
        counts = [0] * _MATCH_TYPES
        for value in board:
            color = _match_color(value)
            if color >= 0:
                counts[color] += 1
        selected = counts.index(max(counts))
        result.extend(index for index, value in enumerate(board) if _match_color(value) == selected)
    return result


def _match_combination(board: list[int], a: int, b: int) -> set[int]:
    kind_a, kind_b = _match_kind(board[a]), _match_kind(board[b])
    clear = {a, b}
    if kind_a == 4 and kind_b == 4:
        return set(range(_MATCH_CELLS))
    if kind_a == 4 or kind_b == 4:
        other = b if kind_a == 4 else a
        target = _match_color(board[other])
        special = _match_kind(board[other])
        for index, value in enumerate(board):
            if _match_color(value) == target:
                clear.add(index)
                if special:
                    board[index] = special * _MATCH_TYPES + target
    elif (
        (kind_a == 3 and kind_b in {1, 2})
        or (kind_b == 3 and kind_a in {1, 2})
    ):
        for index in range(_MATCH_CELLS):
            r, c = divmod(index, _MATCH_SIZE)
            br, bc = divmod(b, _MATCH_SIZE)
            if abs(r - br) <= 1 or abs(c - bc) <= 1:
                clear.add(index)
    elif kind_a == 3 and kind_b == 3:
        br, bc = divmod(b, _MATCH_SIZE)
        for index in range(_MATCH_CELLS):
            r, c = divmod(index, _MATCH_SIZE)
            if abs(r - br) <= 2 and abs(c - bc) <= 2:
                clear.add(index)
    else:
        br, bc = divmod(b, _MATCH_SIZE)
        for index in range(_MATCH_CELLS):
            r, c = divmod(index, _MATCH_SIZE)
            if r == br or c == bc:
                clear.add(index)
    return clear


def _match_renew(state: dict) -> None:
    specials = [value for value in state["board"] if _match_kind(value)]
    state["rng"], state["board"] = _match_generate(state["rng"])
    for index, value in enumerate(specials):
        state["board"][index] = 24 if _match_kind(value) == 4 else _match_kind(value) * _MATCH_TYPES + state["board"][index]


def _match_update_status(state: dict) -> None:
    spec = _match_spec(state["level"])
    state["status"] = (
        "won"
        if state["score"] >= spec["target"] and state["blue"] >= spec["blue"] and not state["ice"]
        else "lost" if state["moves"] <= 0
        else "playing"
    )


def _match_swap(original: dict, a: int, b: int) -> dict:
    if original["status"] != "playing" or not _match_legal(original["board"], a, b):
        raise ValueError("Ungültige Match-Tauschaktionen sind nicht verifizierbar")
    state = {
        **original,
        "board": list(original["board"]),
        "ice": list(original["ice"]),
    }
    special_swap = (
        _match_kind(state["board"][a]) == 4
        or _match_kind(state["board"][b]) == 4
        or (_match_kind(state["board"][a]) and _match_kind(state["board"][b]))
    )
    state["board"][a], state["board"][b] = state["board"][b], state["board"][a]
    state["moves"] -= 1
    state["turns"] += 1
    pending = _match_combination(state["board"], a, b) if special_swap else None
    combo = 0

    while True:
        matches = _match_groups(state["board"])
        if not matches and pending is None:
            break
        if combo >= 25:
            break
        combo += 1
        created = [] if pending is not None else _match_creations(
            state["board"], matches, [b, a] if combo == 1 else []
        )
        clear = set(pending) if pending is not None else {
            cell for group in matches for cell in group["cells"]
        }
        activated = {
            cell for cell in (a, b)
            if pending is not None and _match_kind(state["board"][cell]) == 4
        }
        pending = None
        queue = list(clear)
        cursor = 0
        while cursor < len(queue):
            at = queue[cursor]
            cursor += 1
            if not _match_kind(state["board"][at]) or at in activated:
                continue
            activated.add(at)
            for cell in _match_effect(state["board"], at):
                if cell not in clear:
                    clear.add(cell)
                    queue.append(cell)

        hit = set(clear)
        for item in created:
            clear.discard(item["at"])
        state["score"] += len(clear) * 10 * min(combo, 4)
        state["blue"] += sum(1 for cell in clear if _match_color(state["board"][cell]) == 0)
        state["ice"] = [cell for cell in state["ice"] if cell not in hit]
        for item in created:
            state["board"][item["at"]] = item["value"]

        for col in range(_MATCH_SIZE):
            remaining = []
            for row in range(_MATCH_SIZE - 1, -1, -1):
                index = row * _MATCH_SIZE + col
                if index not in clear:
                    remaining.append(state["board"][index])
            cursor = 0
            for row in range(_MATCH_SIZE - 1, -1, -1):
                index = row * _MATCH_SIZE + col
                if cursor < len(remaining):
                    state["board"][index] = remaining[cursor]
                else:
                    state["rng"], random_value = _match_random(state["rng"])
                    state["board"][index] = int(random_value * _MATCH_TYPES)
                cursor += 1

    if _match_groups(state["board"]) or not _match_hint(state["board"]):
        _match_renew(state)
    _match_update_status(state)
    return state


def replay_match(level: int, seed: int, actions: list[MatchSwapInput | dict]) -> dict:
    state = _match_create(level, seed)
    for action in actions:
        if state["status"] != "playing":
            raise ValueError("Match-Aktionen nach Rundenende sind nicht erlaubt")
        a = action.a if isinstance(action, MatchSwapInput) else int(action["a"])
        b = action.b if isinstance(action, MatchSwapInput) else int(action["b"])
        state = _match_swap(state, a, b)

    spec = _match_spec(level)
    stars = (
        3 if state["status"] == "won" and state["moves"] >= spec["moves"] * .5
        else 2 if state["status"] == "won" and state["moves"] >= spec["moves"] * .2
        else 1 if state["status"] == "won"
        else 0
    )
    return {
        "status": state["status"],
        "level": level,
        "score": state["score"],
        "blue": state["blue"],
        "ice_remaining": len(state["ice"]),
        "stars": stars,
        "turns": state["turns"],
        "moves": state["moves"],
    }


def _match_verified_public(doc: dict | None) -> dict:
    if not doc:
        return {
            "version": 1,
            "best": [0] * _MATCH_LEVELS,
            "stars": [0] * _MATCH_LEVELS,
            "verified_levels": 0,
            "updated_at": None,
            "integrity": "server_replayed_not_full_anti_cheat",
        }
    best = doc.get("best") if isinstance(doc.get("best"), list) and len(doc["best"]) == _MATCH_LEVELS else [0] * _MATCH_LEVELS
    stars = doc.get("stars") if isinstance(doc.get("stars"), list) and len(doc["stars"]) == _MATCH_LEVELS else [0] * _MATCH_LEVELS
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


@router.post("/match/sessions")
async def create_match_integrity_session(body: MatchSessionInput, request: Request):
    owner_id = await _owner(request)
    progress = await db.games_match_progress.find_one(
        {"owner_id": owner_id},
        {"_id": 0, "unlocked": 1},
    )
    unlocked = max(1, min(_MATCH_LEVELS, int((progress or {}).get("unlocked") or 1)))
    if body.level > unlocked:
        raise HTTPException(409, "Dieses Match-Level ist noch nicht freigeschaltet")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=_SESSION_TTL_MINUTES)
    seed = secrets.randbits(32) or 123456
    session_id = secrets.token_hex(16)
    await db.games_integrity_sessions.insert_one({
        "_id": session_id,
        "owner_id": owner_id,
        "game_id": "match",
        "level": body.level,
        "seed": seed,
        "used": False,
        "created_at": now,
        "expires_at": expires_at,
    })
    return {
        "session_id": session_id,
        "game_id": "match",
        "level": body.level,
        "seed": seed,
        "expires_at": expires_at.isoformat(),
        "score_verification": "server_replay_required",
    }


@router.post("/match/verify")
async def verify_match_integrity(body: MatchVerifyInput, request: Request):
    owner_id = await _owner(request)
    now = datetime.now(timezone.utc)
    session = await db.games_integrity_sessions.find_one({
        "_id": body.session_id,
        "owner_id": owner_id,
        "game_id": "match",
        "used": False,
    })
    if not session:
        raise HTTPException(404, "Match-Verifikationssession nicht gefunden")
    expires_at = session.get("expires_at")
    if not isinstance(expires_at, datetime) or expires_at <= now:
        raise HTTPException(410, "Match-Verifikationssession ist abgelaufen")

    level = int(session.get("level") or 0)
    seed = int(session.get("seed") or 0)
    try:
        result = replay_match(level, seed, body.actions)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if result["status"] != "won":
        raise HTTPException(422, "Match-Runde konnte serverseitig nicht als gewonnen bestätigt werden")

    consumed = await db.games_integrity_sessions.update_one(
        {
            "_id": body.session_id,
            "owner_id": owner_id,
            "game_id": "match",
            "used": False,
            "expires_at": {"$gt": now},
        },
        {"$set": {"used": True, "used_at": now}},
    )
    if not getattr(consumed, "matched_count", 0):
        raise HTTPException(409, "Match-Verifikationssession wurde bereits verwendet")

    index = level - 1
    timestamp = now.isoformat()
    await db.games_match_verified_progress.update_one(
        {"owner_id": owner_id},
        {
            "$setOnInsert": {
                "owner_id": owner_id,
                "version": 1,
                "best": [0] * _MATCH_LEVELS,
                "stars": [0] * _MATCH_LEVELS,
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


@router.get("/match/me")
async def get_match_verified_progress(request: Request):
    owner_id = await _owner(request)
    doc = await db.games_match_verified_progress.find_one(
        {"owner_id": owner_id},
        {"_id": 0, "owner_id": 0},
    )
    return _match_verified_public(doc)


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
