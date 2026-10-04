"""Preflight isolation, secret handling, and the pinned PyMongo API contract."""
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock, create_autospec

import pytest
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "the_eye_data_preflight", ROOT / "scripts/the_eye_data_preflight.py",
)
preflight = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(preflight)


@pytest.fixture
def source(tmp_path):
    routes = tmp_path / "backend/routes"
    core = tmp_path / "backend/core"
    routes.mkdir(parents=True)
    core.mkdir()
    (routes / "the_eye_devices.py").write_text(
        'raise RuntimeError("Must never import app code")\n'
        'db.the_eye_devices.find({})\n'
        'db["the_eye_locations"].find({})\n'
        'db.users.find({})\n'
        'db[collection].find({})\n'
        '# db.the_eye_comment.find({})\n'
    )
    (core / "database.py").write_text(
        'db.the_eye_devices.create_index("device_id")\n'
        'db.bidblitz_payments.find({})\n'
    )
    return tmp_path


def test_inventory_distinguishes_code_from_runtime_and_shared_data(source):
    report = preflight.make_report(source)
    assert [c["name"] for c in report["code_inventory"]["collections"]] == [
        "the_eye_devices", "the_eye_locations",
    ]
    assert report["code_inventory"]["shared_dependencies_excluded"] == ["users"]
    assert report["code_inventory"]["unresolved_db_references"] == [
        {"file": "backend/routes/the_eye_devices.py", "line": 5},
    ]
    assert report["source_inspection"]["status"] == "NOT_INSPECTED"
    assert report["migration_completed"] is False
    assert report["source_identity_verified"] is False
    assert report["shared_data_read"] is False


def test_fingerprint_changes_with_source(source):
    before = preflight.code_inventory(source)["source_sha256"]
    path = source / "backend/routes/the_eye_devices.py"
    path.write_text(path.read_text() + "db.the_eye_incidents.find({})\n")
    assert preflight.code_inventory(source)["source_sha256"] != before


def test_default_cli_never_constructs_database_client(source, monkeypatch, capsys):
    def forbidden(*args, **kwargs):
        pytest.fail("Offline inventory contacted MongoDB")
    monkeypatch.setitem(sys.modules, "pymongo", SimpleNamespace(MongoClient=forbidden))
    output = source / "inventory.json"
    assert preflight.main(["--repo", str(source), "--output", str(output)]) == 0
    report = json.loads(output.read_text())
    assert report["source_inspection"]["status"] == "NOT_INSPECTED"
    assert output.stat().st_mode & 0o777 == 0o600
    assert "no data migrated" in capsys.readouterr().out


def test_existing_report_is_never_overwritten(tmp_path):
    target = tmp_path / "report.json"
    target.write_text("existing")
    with pytest.raises(FileExistsError):
        preflight.write_report(target, {"migration_completed": False})
    assert target.read_text() == "existing"


def test_report_symlink_is_never_followed(tmp_path):
    target = tmp_path / "target"
    target.write_text("existing")
    link = tmp_path / "report.json"
    link.symlink_to(target)
    with pytest.raises(FileExistsError):
        preflight.write_report(link, {})
    assert target.read_text() == "existing"


def config_file(tmp_path, mode=0o600, **changes):
    path = tmp_path / "source-config.json"
    content = {"mongo_url": "mongodb://reader:PRIVATE_SECRET@localhost/db", "db_name": "eye"}
    content.update(changes)
    path.write_text(json.dumps(content))
    path.chmod(mode)
    return path


@pytest.mark.parametrize("mode", [0o644, 0o640, 0o606])
def test_shared_readable_credentials_are_rejected(tmp_path, mode):
    with pytest.raises(ValueError):
        preflight.load_config(config_file(tmp_path, mode))


def test_private_config_is_accepted_without_returning_it_in_report(tmp_path, source):
    uri, database = preflight.load_config(config_file(tmp_path))
    assert "PRIVATE_SECRET" in uri
    assert database == "eye"
    assert "PRIVATE_SECRET" not in json.dumps(preflight.make_report(source))


def test_config_symlink_is_rejected(tmp_path):
    target = config_file(tmp_path)
    link = tmp_path / "link.json"
    link.symlink_to(target)
    with pytest.raises(OSError):
        preflight.load_config(link)


@pytest.mark.parametrize("changes", [
    {"db_name": "../users"}, {"db_name": ""}, {"db_name": None},
    {"mongo_url": "https://example.com"}, {"other_secret": "PRIVATE_SECRET"},
])
def test_invalid_config_is_rejected(tmp_path, changes):
    with pytest.raises(ValueError):
        preflight.load_config(config_file(tmp_path, **changes))


def fake_source():
    # Autospec catches unsupported kwargs in the repository's actual driver version.
    client = create_autospec(MongoClient, instance=True)
    database = create_autospec(Database, instance=True)
    collection = create_autospec(Collection, instance=True)
    client.__getitem__.return_value = database
    database.list_collection_names.return_value = [
        "the_eye_devices", "the_eye_legacy",
    ]
    database.__getitem__.return_value = collection
    collection.count_documents.return_value = 7
    cursor = MagicMock()
    cursor.__enter__.return_value = iter([
        {"name": "_id_", "private_filter_value": "PRIVATE_SECRET"},
    ])
    collection.list_indexes.return_value = cursor
    return client, database, collection


def test_source_inspection_counts_only_explicit_project_collections(source):
    report = preflight.make_report(source)
    client, database, collection = fake_source()
    assert preflight.inspect_source(report, client, "eye") is True
    database.list_collection_names.assert_called_once_with(
        filter={"name": {"$regex": "^the_eye_"}}, maxTimeMS=5000,
    )
    database.__getitem__.assert_called_once_with("the_eye_devices")
    collection.count_documents.assert_called_once_with({}, maxTimeMS=5000)
    collection.list_indexes.assert_called_once_with()
    client.close.assert_called_once_with()
    inspection = report["source_inspection"]
    assert inspection["collections"] == [
        {"name": "the_eye_devices", "present": True, "document_count": 7, "index_count": 1},
        {"name": "the_eye_locations", "present": False},
    ]
    assert inspection["unreferenced_the_eye_collections"] == ["the_eye_legacy"]
    assert inspection["consistent_snapshot"] is False
    assert inspection["backup_created"] is False
    assert report["migration_completed"] is False
    assert report["source_identity_verified"] is False
    assert "PRIVATE_SECRET" not in json.dumps(report)


def test_shared_collection_in_manifest_is_rejected_before_database_access(source):
    report = preflight.make_report(source)
    report["code_inventory"]["collections"].append({"name": "users"})
    client, database, collection = fake_source()
    assert preflight.inspect_source(report, client, "eye") is False
    client.__getitem__.assert_not_called()
    client.close.assert_called_once_with()
    assert report["source_inspection"]["status"] == "FAILED"


def test_source_error_never_exposes_credentials(source):
    report = preflight.make_report(source)
    client, database, collection = fake_source()
    collection.count_documents.side_effect = RuntimeError(
        "mongodb://reader:PRIVATE_SECRET@private-host/eye",
    )
    assert preflight.inspect_source(report, client, "eye") is False
    assert report["source_inspection"]["status"] == "FAILED"
    assert report["source_inspection"]["error"] == "SOURCE_INSPECTION_FAILED"
    assert "PRIVATE_SECRET" not in json.dumps(report)
    assert "private-host" not in json.dumps(report)
    client.close.assert_called_once_with()


def test_unfiltered_collection_names_are_not_saved(source):
    report = preflight.make_report(source)
    client, database, collection = fake_source()
    database.list_collection_names.return_value = ["users", "PRIVATE_SECRET"]
    assert preflight.inspect_source(report, client, "eye") is False
    database.__getitem__.assert_not_called()
    assert "PRIVATE_SECRET" not in json.dumps(report)


def test_setup_failure_produces_generic_failure_report(source, tmp_path, capsys):
    config = config_file(tmp_path, mongo_url="PRIVATE_SECRET")
    output = tmp_path / "failed.json"
    assert preflight.main([
        "--repo", str(source), "--output", str(output),
        "--inspect-source", "--config", str(config),
    ]) == 2
    report = json.loads(output.read_text())
    assert report["source_inspection"]["status"] == "FAILED"
    assert report["source_inspection"]["error"] == "SOURCE_SETUP_FAILED"
    assert report["migration_completed"] is False
    captured = capsys.readouterr()
    assert "PRIVATE_SECRET" not in captured.out + captured.err + output.read_text()


def test_malformed_code_fails_without_traceback(source, capsys):
    (source / "backend/routes/the_eye_devices.py").write_text("PRIVATE_SECRET = [")
    assert preflight.main(["--repo", str(source), "--output", str(source / "none.json")]) == 2
    assert not (source / "none.json").exists()
    assert "PRIVATE_SECRET" not in capsys.readouterr().err


def test_pinned_driver_accepts_bounded_client_options_without_connecting():
    with MongoClient(
        "mongodb://127.0.0.1:1", connect=False,
        serverSelectionTimeoutMS=5000, connectTimeoutMS=5000,
        socketTimeoutMS=5000, timeoutMS=5000,
        appname="the-eye-read-only-preflight",
    ) as client:
        assert client.options.timeout == 5.0
