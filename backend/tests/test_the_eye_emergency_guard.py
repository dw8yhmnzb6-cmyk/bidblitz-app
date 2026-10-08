"""Regression tests for The Eye emergency write guard.

These tests isolate the guard logic to avoid requiring a live MongoDB.
"""
import ast
import asyncio
from pathlib import Path

import pytest
from fastapi import HTTPException


ROOT = Path(__file__).resolve().parents[1]
GUARD_FILE = ROOT / "core" / "the_eye_guard.py"


def _load_guard_functions():
    tree = ast.parse(GUARD_FILE.read_text(encoding="utf-8"))
    selected = [
        node for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        and node.name in {"classify_the_eye_write", "require_the_eye_writes_allowed"}
    ]
    assert len(selected) == 2, "The Eye guard functions must exist"
    namespace = {
        "HTTPException": HTTPException,
        "TheEyeWriteClass": str,
        "_WRITE_METHODS": frozenset({"POST", "PUT", "PATCH", "DELETE"}),
        "_RECOVERY_PATHS": frozenset({"/api/the-eye/admin/continuity/emergency-mode"}),
        "_OBSERVATION_PATTERNS": (),
    }
    # Read the production guard constants, not approximated test constants.
    constant_nodes = [
        node for node in tree.body
        if isinstance(node, (ast.Assign, ast.AnnAssign))
        and any(
            isinstance(target, ast.Name)
            and target.id in {"_WRITE_METHODS", "_RECOVERY_PATHS", "_OBSERVATION_PATTERNS"}
            for target in (node.targets if isinstance(node, ast.Assign) else [node.target])
        )
    ]
    import re
    namespace["re"] = re
    exec(compile(ast.Module(body=constant_nodes + selected, type_ignores=[]), str(GUARD_FILE), "exec"), namespace)
    return namespace


@pytest.mark.parametrize("mode,allowed", [
    ("normal", True),
    ("read_only", False),
    ("lockdown", False),
    ("unexpected_mode", False),
    ("", False),
])
def test_device_control_obeys_emergency_mode(mode, allowed):
    namespace = _load_guard_functions()

    async def current_mode():
        return mode

    namespace["get_the_eye_emergency_mode"] = current_mode
    if allowed:
        assert asyncio.run(namespace["require_the_eye_writes_allowed"]("device_command")) == mode
    else:
        with pytest.raises(HTTPException) as exc:
            asyncio.run(namespace["require_the_eye_writes_allowed"]("device_command"))
        assert exc.value.status_code == 423


def test_read_only_override_never_bypasses_lockdown():
    namespace = _load_guard_functions()

    async def current_mode():
        return "lockdown"

    namespace["get_the_eye_emergency_mode"] = current_mode
    with pytest.raises(HTTPException) as exc:
        asyncio.run(namespace["require_the_eye_writes_allowed"](
            "device_command", allow_in_read_only=True
        ))
    assert exc.value.status_code == 423


def test_write_classification_preserves_recovery_and_observation():
    namespace = _load_guard_functions()
    classify = namespace["classify_the_eye_write"]
    assert classify("/api/the-eye/admin/devices/x/commands", "POST") == "control"
    assert classify("/api/the-eye/admin/continuity/emergency-mode", "POST") == "recovery"
    assert classify("/api/the-eye/devices/x/heartbeat", "POST") == "observation"
    assert classify("/api/the-eye/admin/devices", "GET") == "read"
