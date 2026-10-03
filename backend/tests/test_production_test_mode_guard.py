import os
import subprocess
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent.parent


def _read_effective_test_mode(app_env: str, requested_test_mode: str) -> str:
    env = os.environ.copy()
    env["APP_ENV"] = app_env
    env["TEST_MODE"] = requested_test_mode
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "from core.config import TEST_MODE; print(TEST_MODE)",
        ],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def test_test_mode_is_forced_off_in_production():
    assert _read_effective_test_mode("production", "true") == "False"


def test_test_mode_can_be_enabled_in_non_production():
    assert _read_effective_test_mode("development", "true") == "True"
