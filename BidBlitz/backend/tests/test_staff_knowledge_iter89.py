"""Iter89 — Backend Test: Staff Knowledge Base + Shift PATCH."""
import os
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend/.env style
    try:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
    except Exception:
        pass

MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PW = "Haendler2026!"


@pytest.fixture(scope="module")
def merchant_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": MERCHANT_EMAIL, "password": MERCHANT_PW})
    assert r.status_code == 200, f"Merchant login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def staff_session(merchant_session):
    """Login via /staff/auth/login using pre-existing test staff (from test_credentials.md)."""
    s_email = "TEST_magic_1778611082@example.com"
    staff_sess = requests.Session()
    lr = staff_sess.post(f"{BASE_URL}/api/staff/auth/login", json={"email": s_email, "password": "test123"})
    if lr.status_code != 200:
        # Try reset via member list lookup if available
        pytest.skip(f"Staff login failed: {lr.status_code} {lr.text}")
    member = lr.json()["staff"]
    return {"session": staff_sess, "member": member}


# ─────────── Knowledge Base CRUD (Merchant) ───────────
class TestKnowledgeBaseMerchant:
    article_id = None

    def test_create_article(self, merchant_session):
        r = merchant_session.post(f"{BASE_URL}/api/staff/knowledge/articles", json={
            "title": "TEST_Iter89 Cappuccino-Rezept",
            "content": "# Cappuccino\n\n- Espresso\n- Milchschaum\n\n**Tipp:** 60°C.",
            "category": "TEST_Iter89_Rezepte",
            "tags": ["espresso", "milch"],
            "pinned": False,
            "published": False,
        })
        assert r.status_code == 200, r.text
        a = r.json()["article"]
        assert a["title"].startswith("TEST_Iter89")
        assert a["slug"].startswith("test_iter89") or "cappuccino" in a["slug"]
        assert a["published"] is False
        assert a["view_count"] == 0
        TestKnowledgeBaseMerchant.article_id = a["id"]

    def test_list_articles_with_filter(self, merchant_session):
        r = merchant_session.get(f"{BASE_URL}/api/staff/knowledge/articles?q=Cappuccino&category=TEST_Iter89_Rezepte")
        assert r.status_code == 200
        items = r.json()["articles"]
        assert any(x["id"] == TestKnowledgeBaseMerchant.article_id for x in items)

    def test_categories_manager_includes_drafts(self, merchant_session):
        r = merchant_session.get(f"{BASE_URL}/api/staff/knowledge/categories")
        assert r.status_code == 200
        cats = r.json()["categories"]
        assert "TEST_Iter89_Rezepte" in cats  # even though unpublished

    def test_patch_article_publish_and_rename(self, merchant_session):
        aid = TestKnowledgeBaseMerchant.article_id
        r = merchant_session.patch(f"{BASE_URL}/api/staff/knowledge/articles/{aid}", json={
            "published": True, "pinned": True, "title": "TEST_Iter89 Cappuccino Renamed",
        })
        assert r.status_code == 200
        a = r.json()["article"]
        assert a["published"] is True
        assert a["pinned"] is True
        assert "renamed" in a["slug"]

    def test_patch_404(self, merchant_session):
        r = merchant_session.patch(f"{BASE_URL}/api/staff/knowledge/articles/nonexistent-xyz", json={"pinned": True})
        assert r.status_code == 404


# ─────────── Knowledge Base Staff View ───────────
class TestKnowledgeBaseStaff:
    def test_me_articles_only_published(self, staff_session, merchant_session):
        # Create unpublished article
        r = merchant_session.post(f"{BASE_URL}/api/staff/knowledge/articles", json={
            "title": "TEST_Iter89 Draft Only", "content": "secret", "published": False,
        })
        assert r.status_code == 200
        draft_id = r.json()["article"]["id"]

        # Staff should NOT see the draft
        sr = staff_session["session"].get(f"{BASE_URL}/api/staff/knowledge/me/articles")
        assert sr.status_code == 200
        ids = [a["id"] for a in sr.json()["articles"]]
        assert draft_id not in ids

        # Cleanup
        merchant_session.delete(f"{BASE_URL}/api/staff/knowledge/articles/{draft_id}")

    def test_me_read_increments_view_count(self, staff_session, merchant_session):
        aid = TestKnowledgeBaseMerchant.article_id
        # Make sure it's published
        merchant_session.patch(f"{BASE_URL}/api/staff/knowledge/articles/{aid}", json={"published": True})

        r1 = staff_session["session"].get(f"{BASE_URL}/api/staff/knowledge/me/articles/{aid}")
        assert r1.status_code == 200, r1.text
        v1 = r1.json()["article"]["view_count"]

        r2 = staff_session["session"].get(f"{BASE_URL}/api/staff/knowledge/me/articles/{aid}")
        assert r2.status_code == 200
        v2 = r2.json()["article"]["view_count"]
        assert v2 == v1 + 1, f"view_count did not increment: {v1} -> {v2}"

    def test_me_categories_only_published(self, staff_session):
        r = staff_session["session"].get(f"{BASE_URL}/api/staff/knowledge/me/categories")
        assert r.status_code == 200
        cats = r.json()["categories"]
        assert "TEST_Iter89_Rezepte" in cats

    def test_me_articles_requires_auth(self):
        # No cookie → 401
        r = requests.get(f"{BASE_URL}/api/staff/knowledge/me/articles")
        assert r.status_code == 401


# ─────────── Shift PATCH ───────────
class TestShiftPatch:
    def test_create_then_patch_shift(self, merchant_session, staff_session):
        sid = staff_session["member"]["id"]
        cr = merchant_session.post(f"{BASE_URL}/api/staff/shifts", json={
            "staff_id": sid,
            "title": "TEST_Iter89 Morning",
            "start_time": "2026-01-26T08:00:00Z",
            "end_time": "2026-01-26T12:00:00Z",
            "location": "Filiale A",
        })
        assert cr.status_code == 200, cr.text
        shift_id = cr.json()["shift"]["id"]

        # Patch: move to different time
        pr = merchant_session.patch(f"{BASE_URL}/api/staff/shifts/{shift_id}", json={
            "start_time": "2026-01-27T10:00:00Z",
            "end_time": "2026-01-27T14:00:00Z",
        })
        assert pr.status_code == 200, pr.text
        s = pr.json()["shift"]
        assert s["start_time"].startswith("2026-01-27T10:00")
        assert s["end_time"].startswith("2026-01-27T14:00")
        assert s["staff_id"] == sid  # unchanged

        # Cleanup
        merchant_session.delete(f"{BASE_URL}/api/staff/shifts/{shift_id}")

    def test_patch_unknown_shift_404(self, merchant_session):
        r = merchant_session.patch(f"{BASE_URL}/api/staff/shifts/nonexistent-xyz", json={
            "start_time": "2026-01-27T10:00:00Z",
        })
        assert r.status_code == 404


# ─────────── Delete + cleanup ───────────
def test_delete_article_and_verify(merchant_session):
    aid = TestKnowledgeBaseMerchant.article_id
    r = merchant_session.delete(f"{BASE_URL}/api/staff/knowledge/articles/{aid}")
    assert r.status_code == 200
    # 404 the second time
    r2 = merchant_session.delete(f"{BASE_URL}/api/staff/knowledge/articles/{aid}")
    assert r2.status_code == 404
