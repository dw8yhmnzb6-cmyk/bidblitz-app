"""Regression contracts for admin service-module CRUD wiring."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_core_service_modules_have_real_admin_crud_backing():
    backend = read("backend/routes/admin_management.py")
    page = read("frontend/src/pages/AdminManagementPage.jsx")
    router = read("frontend/src/components/admin/AdminDetailRouter.jsx")

    for key, collection in [
        ("immobilien", "real_estate"),
        ("freelancer", "freelancers"),
        ("elearning", "elearning_courses"),
    ]:
        assert f'"{key}": ("{collection}"' in backend
        assert f'key: "{key}"' in page

    assert 'Immobilien: "immobilien"' in router
    assert 'Freelancer: "freelancer"' in router
    assert '"E-Learning": "elearning"' in router


def test_admin_module_list_exposes_stable_ids_for_legacy_records():
    backend = read("backend/routes/admin_management.py")
    page = read("frontend/src/pages/AdminManagementPage.jsx")

    assert 'mongo_id = item.pop("_id", None)' in backend
    assert 'item["id"] = str(mongo_id)' in backend
    assert 'encodeURIComponent(item.id || item._id)' in page
    assert 'encodeURIComponent(id)' in page


def test_new_core_service_records_are_public_ready():
    backend = read("backend/routes/admin_management.py")

    assert 'data["listing_id"] = data.get("listing_id") or data["id"]' in backend
    assert 'data["status"] = data.get("status") or "active"' in backend
    assert 'data["freelancer_id"] = data.get("freelancer_id") or data["id"]' in backend
    assert 'data["available"] = True if data.get("available") is None else bool(data.get("available"))' in backend
    assert 'data["course_id"] = data.get("course_id") or data["id"]' in backend
    assert 'data["status"] = data.get("status") or "published"' in backend
