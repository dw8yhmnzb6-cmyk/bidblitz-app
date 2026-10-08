"""Static regression checks for The Eye camera-session safety gates.

No external camera, database, or network is required for these checks.
Runtime integration tests remain separately necessary.
"""
import ast
from pathlib import Path

CAMERAS = Path(__file__).resolve().parents[1] / "routes" / "the_eye_cameras.py"


def _session_function():
    module = ast.parse(CAMERAS.read_text(encoding="utf-8"))
    matches = [
        node for node in module.body
        if isinstance(node, ast.AsyncFunctionDef)
        and node.name == "create_camera_stream_session"
    ]
    assert len(matches) == 1
    return matches[0]


def _statement_index(function, fragment):
    matches = [
        index for index, statement in enumerate(function.body)
        if fragment in ast.unparse(statement)
    ]
    assert len(matches) == 1, f"Expected exactly one statement containing {fragment!r}"
    return matches[0]


def test_camera_connection_is_checked_before_session_is_inserted():
    function = _session_function()
    connection = _statement_index(function, 'connection_status')
    insert = _statement_index(function, 'the_eye_camera_sessions.insert_one')
    condition = function.body[connection]
    assert isinstance(condition, ast.If)
    assert 'not in' in ast.unparse(condition.test)
    assert "'online'" in ast.unparse(condition.test)
    assert "'warning'" in ast.unparse(condition.test)
    assert any(
        isinstance(node, ast.Raise) and "409" in ast.unparse(node)
        for node in ast.walk(condition)
    )
    assert connection < insert


def test_unconfigured_media_gateway_is_rejected_before_session_insert():
    function = _session_function()
    config_check = _statement_index(function, 'not gateway or not stream_path')
    insert = _statement_index(function, 'the_eye_camera_sessions.insert_one')
    statement = function.body[config_check]
    assert isinstance(statement, ast.If)
    assert any(
        isinstance(node, ast.Raise) and "503" in ast.unparse(node)
        for node in ast.walk(statement)
    )
    assert config_check < insert
