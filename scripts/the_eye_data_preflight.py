#!/usr/bin/env python3
"""Read-only The Eye collection inventory; never a dump or migration."""
from __future__ import annotations

import argparse
import ast
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

COLLECTION_NAME = re.compile(r"^[a-z][a-z0-9_]*$")
DB_METHODS = {"command", "get_collection", "list_collection_names",
              "list_collections", "create_collection", "drop_collection",
              "name", "client"}
QUERY_TIMEOUT_MS = 5000


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def code_inventory(root):
    """Inspect literal db.name/db["name"] references without importing the app."""
    root = Path(root)
    files = sorted([
        *root.joinpath("backend/core").glob("the_eye*.py"),
        *root.joinpath("backend/routes").glob("the_eye*.py"),
    ])
    if not files:
        raise ValueError("The Eye source modules are missing")
    database_module = root / "backend/core/database.py"
    if database_module.is_file():
        files.append(database_module)

    owned, shared, unresolved = {}, set(), []
    digest = hashlib.sha256()
    for path in files:
        relative = path.relative_to(root).as_posix()
        contents = path.read_bytes()
        digest.update(relative.encode() + b"\0" + contents + b"\0")
        tree = ast.parse(contents, filename=relative)
        for node in ast.walk(tree):
            name = None
            if isinstance(node, ast.Attribute):
                if isinstance(node.value, ast.Name) and node.value.id == "db":
                    name = node.attr
            elif isinstance(node, ast.Subscript):
                if isinstance(node.value, ast.Name) and node.value.id == "db":
                    if isinstance(node.slice, ast.Constant) and isinstance(node.slice.value, str):
                        name = node.slice.value
                    else:
                        unresolved.append({"file": relative, "line": node.lineno})
            if name is None or name in DB_METHODS:
                continue
            if not COLLECTION_NAME.fullmatch(name):
                unresolved.append({"file": relative, "line": node.lineno})
                continue
            if name.startswith("the_eye_"):
                owned.setdefault(name, []).append({"file": relative, "line": node.lineno})
            elif path != database_module:
                shared.add(name)

    if not owned:
        raise ValueError("No literal The Eye collections found")
    return {
        "collection_count": len(owned),
        "collections": [{"name": name, "references": owned[name]} for name in sorted(owned)],
        "shared_dependencies_excluded": sorted(shared),
        "unresolved_db_references": unresolved,
        "coverage": "literal_db_references_in_the_eye_modules_and_database_setup",
        "source_sha256": digest.hexdigest(),
    }


def git_state(root):
    result = {"commit": None, "worktree_dirty": None}
    for key, args in (
        ("commit", ["rev-parse", "HEAD"]),
        ("worktree_dirty", ["status", "--porcelain"]),
    ):
        try:
            process = subprocess.run(
                ["git", "-C", str(root), *args], capture_output=True,
                text=True, timeout=10, check=True,
            )
            result[key] = bool(process.stdout.strip()) if key == "worktree_dirty" else process.stdout.strip()
        except (OSError, subprocess.SubprocessError):
            pass
    return result


def load_config(path):
    """Credentials come only from a private regular JSON file, never CLI values."""
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0)
    descriptor = os.open(path, flags)
    try:
        info = os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077:
            raise ValueError("Configuration must be a private regular file")
        if info.st_size > 65536:
            raise ValueError("Configuration is too large")
        with os.fdopen(descriptor, encoding="utf-8") as handle:
            descriptor = None
            config = json.load(handle)
    finally:
        if descriptor is not None:
            os.close(descriptor)
    if not isinstance(config, dict) or set(config) != {"mongo_url", "db_name"}:
        raise ValueError("Configuration keys are invalid")
    uri, database = config["mongo_url"], config["db_name"]
    if not isinstance(uri, str) or not uri.startswith(("mongodb://", "mongodb+srv://")):
        raise ValueError("MongoDB URI is invalid")
    if not isinstance(database, str) or not database or any(char in database for char in '/\\. "$\0'):
        raise ValueError("Database name is invalid")
    return uri, database


def make_report(root):
    return {
        "schema_version": 1,
        "generated_at": timestamp(),
        "project": "the-eye",
        "git": git_state(root),
        "code_inventory": code_inventory(root),
        "source_inspection": {"status": "NOT_INSPECTED", "collections": []},
        "source_identity_verified": False,
        "migration_completed": False,
        "production_changed": False,
        "shared_data_read": False,
    }


def inspect_source(report, client, database_name):
    """Read metadata/counts only; the injected client can be restricted to read."""
    inspection = report["source_inspection"]
    inspection.update(status="IN_PROGRESS", started_at=timestamp())
    try:
        expected = {item["name"] for item in report["code_inventory"]["collections"]}
        if not expected or any(not name.startswith("the_eye_") or not COLLECTION_NAME.fullmatch(name) for name in expected):
            raise ValueError("Only literal The Eye collections can be inspected")
        database = client[database_name]
        names = set(database.list_collection_names(
            filter={"name": {"$regex": "^the_eye_"}}, maxTimeMS=QUERY_TIMEOUT_MS,
        ))
        if any(not isinstance(name, str) or not name.startswith("the_eye_") for name in names):
            raise ValueError("Source collection filter was not respected")
        unexpected = sorted(name for name in names if name not in expected)
        inspection["unreferenced_the_eye_collections"] = unexpected
        for name in sorted(expected):
            item = {"name": name, "present": name in names}
            inspection["collections"].append(item)
            if name in names:
                collection = database[name]
                item["document_count"] = collection.count_documents({}, maxTimeMS=QUERY_TIMEOUT_MS)
                with collection.list_indexes() as indexes:
                    item["index_count"] = sum(1 for _ in indexes)
        inspection["status"] = "COMPLETED"
        inspection["consistent_snapshot"] = False
        inspection["backup_created"] = False
        return True
    except Exception:
        # Driver errors can contain a URI, host, password, or server data.
        inspection["status"] = "FAILED"
        inspection["error"] = "SOURCE_INSPECTION_FAILED"
        return False
    finally:
        inspection["finished_at"] = timestamp()
        try:
            client.close()
        except Exception:
            inspection["client_cleanup_failed"] = True


def write_report(path, report):
    """Create a new private report; never truncate existing files or follow symlinks."""
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--inspect-source", action="store_true")
    parser.add_argument("--config", type=Path)
    args = parser.parse_args(argv)
    if args.inspect_source != bool(args.config):
        parser.error("--inspect-source and --config must be supplied together")
    try:
        report = make_report(args.repo)
    except (OSError, ValueError, SyntaxError):
        print("Code inventory failed; no source contacted.", file=sys.stderr)
        return 2
    success = True
    if args.inspect_source:
        report["source_inspection"]["status"] = "FAILED"
        try:
            uri, database = load_config(args.config)
            from pymongo import MongoClient
            client = MongoClient(
                uri, serverSelectionTimeoutMS=QUERY_TIMEOUT_MS,
                connectTimeoutMS=QUERY_TIMEOUT_MS, socketTimeoutMS=QUERY_TIMEOUT_MS,
                timeoutMS=QUERY_TIMEOUT_MS,
                appname="the-eye-read-only-preflight",
            )
            success = inspect_source(report, client, database)
        except Exception:
            # Do not expose config contents or raw driver exception messages.
            report["source_inspection"]["error"] = "SOURCE_SETUP_FAILED"
            success = False
    try:
        write_report(args.output, report)
    except (OSError, TypeError, ValueError):
        print("Private report could not be created.", file=sys.stderr)
        return 2
    print("Read-only inventory report created; no data migrated.")
    return 0 if success else 2


if __name__ == "__main__":
    raise SystemExit(main())
