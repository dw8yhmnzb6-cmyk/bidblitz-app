"""Iter90 — BidBlitz Staff Sprint A: KB cover upload, AI summary, quiz attempts, shift overlap+repeat."""
import io
import os
import time
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as fh:
        for line in fh:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")

MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PW = "Haendler2026!"
STAFF_EMAIL = "TEST_magic_1778611082@example.com"
STAFF_PW = "test123"


# 1x1 PNG (89 bytes) — too small (<64? actually 67) — make a valid larger PNG
# Use a 10x10 PNG generated via simple bytes (still valid PNG but >64 bytes)
PNG_BYTES = bytes.fromhex(
    "89504E470D0A1A0A0000000D49484452000000100000001008060000001FF3FF610000004949444154789C636060606060"
    "606060606060606060606060606060606060606060606060606060606060606060606060606060606060606060606060"
    "606060606060606060606060606060606060606060606060606060606060FE0F00540000000049454E44AE426082"
)


@pytest.fixture(scope="module")
def merchant():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": MERCHANT_EMAIL, "password": MERCHANT_PW})
    assert r.status_code == 200, f"Merchant login fail: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def staff():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/staff/auth/login", json={"email": STAFF_EMAIL, "password": STAFF_PW})
    if r.status_code != 200:
        pytest.skip(f"Staff login failed: {r.status_code} {r.text}")
    return {"session": s, "member": r.json()["staff"]}


# ─────────── Cover Upload ───────────
class TestCoverUpload:
    def test_upload_png_ok(self, merchant):
        files = {"file": ("cover.png", io.BytesIO(PNG_BYTES), "image/png")}
        r = merchant.post(f"{BASE_URL}/api/staff/knowledge/upload-cover", files=files)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["url"].startswith("/uploads/knowledge/")
        # GET the file back
        f = requests.get(f"{BASE_URL}{data['url']}")
        assert f.status_code == 200
        assert len(f.content) >= 64

    def test_upload_invalid_ext(self, merchant):
        files = {"file": ("evil.txt", io.BytesIO(b"hello world" * 10), "text/plain")}
        r = merchant.post(f"{BASE_URL}/api/staff/knowledge/upload-cover", files=files)
        assert r.status_code == 400
        assert "ltig" in r.text.lower() or "invalid" in r.text.lower() or "erlaubt" in r.text.lower()

    def test_upload_too_large(self, merchant):
        # 6MB blob (PNG ext but big content)
        blob = b"\x89PNG\r\n\x1a\n" + b"A" * (6 * 1024 * 1024)
        files = {"file": ("big.png", io.BytesIO(blob), "image/png")}
        r = merchant.post(f"{BASE_URL}/api/staff/knowledge/upload-cover", files=files)
        assert r.status_code == 400
        assert "gro" in r.text.lower() or "5mb" in r.text.lower() or "large" in r.text.lower()

    def test_upload_requires_merchant(self):
        files = {"file": ("cover.png", io.BytesIO(PNG_BYTES), "image/png")}
        r = requests.post(f"{BASE_URL}/api/staff/knowledge/upload-cover", files=files)
        assert r.status_code in (401, 403)


# ─────────── AI Summary + content invalidation ───────────
class TestAISummary:
    article_id = None

    def test_create_article_with_long_content(self, merchant):
        r = merchant.post(f"{BASE_URL}/api/staff/knowledge/articles", json={
            "title": "TEST_Iter90 Espresso-Standard",
            "content": (
                "Ein perfekter Espresso wird bei 92 Grad Celsius extrahiert. "
                "Die Extraktionszeit beträgt 25 Sekunden, die Wassermenge 25ml. "
                "Der Mahlgrad ist mittelfein, das Tampen erfolgt mit 15kg Druck. "
                "Wichtig: Crema sollte haselnussbraun und 2-3mm dick sein."
            ),
            "category": "TEST_Iter90",
            "published": True,
        })
        assert r.status_code == 200, r.text
        TestAISummary.article_id = r.json()["article"]["id"]
        assert r.json()["article"]["ai_summary"] is None

    def test_generate_summary(self, merchant):
        aid = TestAISummary.article_id
        r = merchant.post(f"{BASE_URL}/api/staff/knowledge/articles/{aid}/summary")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["success"] is True
        summary = body["ai_summary"]
        assert isinstance(summary, str) and len(summary) >= 20, f"weird summary: {summary!r}"
        # Verify persisted via list endpoint
        g = merchant.get(f"{BASE_URL}/api/staff/knowledge/articles?q=Espresso-Standard")
        assert g.status_code == 200
        found = [a for a in g.json()["articles"] if a["id"] == aid]
        assert found and found[0]["ai_summary"] == summary

    def test_short_content_returns_400(self, merchant):
        c = merchant.post(f"{BASE_URL}/api/staff/knowledge/articles", json={
            "title": "TEST_Iter90 Short",
            "content": "tiny",
            "published": False,
        })
        assert c.status_code == 200
        sid = c.json()["article"]["id"]
        r = merchant.post(f"{BASE_URL}/api/staff/knowledge/articles/{sid}/summary")
        assert r.status_code == 400
        merchant.delete(f"{BASE_URL}/api/staff/knowledge/articles/{sid}")

    def test_summary_404(self, merchant):
        r = merchant.post(f"{BASE_URL}/api/staff/knowledge/articles/nonexistent-xyz/summary")
        assert r.status_code == 404

    def _get_article(self, merchant, aid):
        r = merchant.get(f"{BASE_URL}/api/staff/knowledge/articles?q=TEST_Iter90")
        assert r.status_code == 200
        for a in r.json()["articles"]:
            if a["id"] == aid:
                return a
        return None

    def test_patch_content_invalidates_summary(self, merchant):
        aid = TestAISummary.article_id
        # Ensure ai_summary exists from previous test
        a = self._get_article(merchant, aid)
        assert a and a["ai_summary"], "summary missing before invalidation test"
        # Patch content
        p = merchant.patch(f"{BASE_URL}/api/staff/knowledge/articles/{aid}", json={
            "content": "Komplett neuer Inhalt mit mehr als 30 Zeichen für Test."
        })
        assert p.status_code == 200
        assert p.json()["article"]["ai_summary"] is None

    def test_patch_other_field_does_not_invalidate(self, merchant):
        aid = TestAISummary.article_id
        # Regenerate summary
        merchant.post(f"{BASE_URL}/api/staff/knowledge/articles/{aid}/summary")
        before = self._get_article(merchant, aid)["ai_summary"]
        assert before
        # Patch title only (pinned change)
        merchant.patch(f"{BASE_URL}/api/staff/knowledge/articles/{aid}", json={"pinned": True})
        after = self._get_article(merchant, aid)["ai_summary"]
        assert after == before


# ─────────── Quiz Submit ───────────
class TestQuizAttempt:
    article_id = None

    def test_create_article_with_quiz(self, merchant):
        r = merchant.post(f"{BASE_URL}/api/staff/knowledge/articles", json={
            "title": "TEST_Iter90 Quiz-Article",
            "content": "Inhalt zum Lernen mit ausreichend Zeichen für Quiz-Test.",
            "category": "TEST_Iter90",
            "published": True,
            "quiz": [
                {"question": "Espresso Temperatur?", "options": ["80°C", "92°C", "100°C"], "correct": 1},
                {"question": "Extraktionszeit?", "options": ["10s", "25s", "60s"], "correct": 1},
            ],
        })
        assert r.status_code == 200, r.text
        TestQuizAttempt.article_id = r.json()["article"]["id"]

    def test_staff_get_strips_correct_index(self, staff):
        aid = TestQuizAttempt.article_id
        r = staff["session"].get(f"{BASE_URL}/api/staff/knowledge/me/articles/{aid}")
        assert r.status_code == 200, r.text
        quiz = r.json()["article"].get("quiz") or []
        assert len(quiz) == 2
        for q in quiz:
            assert "correct" not in q, f"correct leaked to staff: {q}"
            assert isinstance(q.get("options"), list)

    def test_submit_quiz_all_correct(self, staff):
        aid = TestQuizAttempt.article_id
        r = staff["session"].post(
            f"{BASE_URL}/api/staff/knowledge/me/articles/{aid}/quiz-attempt",
            json={"answers": [1, 1]},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["score"] == 2
        assert d["total"] == 2
        assert d["passed"] is True
        assert len(d["results"]) == 2
        assert all(item["ok"] for item in d["results"])

    def test_submit_quiz_mixed(self, staff):
        aid = TestQuizAttempt.article_id
        r = staff["session"].post(
            f"{BASE_URL}/api/staff/knowledge/me/articles/{aid}/quiz-attempt",
            json={"answers": [0, 1]},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["score"] == 1
        assert d["passed"] is False  # 50% < 70%

    def test_last_quiz_attempt_in_get(self, staff):
        aid = TestQuizAttempt.article_id
        r = staff["session"].get(f"{BASE_URL}/api/staff/knowledge/me/articles/{aid}")
        assert r.status_code == 200
        last = r.json()["article"].get("last_quiz_attempt")
        assert last is not None
        assert "score" in last and "total" in last and "passed" in last

    def test_submit_wrong_length(self, staff):
        aid = TestQuizAttempt.article_id
        r = staff["session"].post(
            f"{BASE_URL}/api/staff/knowledge/me/articles/{aid}/quiz-attempt",
            json={"answers": [1]},
        )
        assert r.status_code == 400


# ─────────── Shift Overlap + Repeat ───────────
class TestShiftOverlapRepeat:
    created_ids: list = []

    def _cleanup(self, merchant):
        for sid in TestShiftOverlapRepeat.created_ids:
            merchant.delete(f"{BASE_URL}/api/staff/shifts/{sid}")
        TestShiftOverlapRepeat.created_ids = []

    def test_overlap_returns_409_then_force_true_creates(self, merchant, staff):
        sid = staff["member"]["id"]
        # base shift
        b = merchant.post(f"{BASE_URL}/api/staff/shifts", json={
            "staff_id": sid, "title": "TEST_Iter90 Base",
            "start_time": "2026-07-06T08:00:00Z", "end_time": "2026-07-06T12:00:00Z",
        })
        assert b.status_code == 200, b.text
        TestShiftOverlapRepeat.created_ids.append(b.json()["shift"]["id"])

        # overlapping → 409
        o = merchant.post(f"{BASE_URL}/api/staff/shifts", json={
            "staff_id": sid, "title": "TEST_Iter90 Overlap",
            "start_time": "2026-07-06T10:00:00Z", "end_time": "2026-07-06T14:00:00Z",
        })
        assert o.status_code == 409, o.text
        detail = o.json().get("detail", {})
        if isinstance(detail, dict):
            assert detail.get("code") == "shift_conflict"
            assert isinstance(detail.get("conflicts"), list) and len(detail["conflicts"]) >= 1

        # ?force=true → 200
        f = merchant.post(f"{BASE_URL}/api/staff/shifts?force=true", json={
            "staff_id": sid, "title": "TEST_Iter90 Forced",
            "start_time": "2026-07-06T10:00:00Z", "end_time": "2026-07-06T14:00:00Z",
        })
        assert f.status_code == 200, f.text
        TestShiftOverlapRepeat.created_ids.append(f.json()["shift"]["id"])

    def test_end_before_start_400(self, merchant, staff):
        sid = staff["member"]["id"]
        r = merchant.post(f"{BASE_URL}/api/staff/shifts", json={
            "staff_id": sid, "title": "TEST_Iter90 Bad",
            "start_time": "2026-07-06T15:00:00Z", "end_time": "2026-07-06T14:00:00Z",
        })
        assert r.status_code == 400

    def test_patch_overlap_409_and_force(self, merchant, staff):
        sid = staff["member"]["id"]
        # create non-overlapping
        a = merchant.post(f"{BASE_URL}/api/staff/shifts", json={
            "staff_id": sid, "title": "TEST_Iter90 PatchA",
            "start_time": "2026-07-07T08:00:00Z", "end_time": "2026-07-07T10:00:00Z",
        })
        b = merchant.post(f"{BASE_URL}/api/staff/shifts", json={
            "staff_id": sid, "title": "TEST_Iter90 PatchB",
            "start_time": "2026-07-07T14:00:00Z", "end_time": "2026-07-07T16:00:00Z",
        })
        assert a.status_code == 200 and b.status_code == 200
        a_id = a.json()["shift"]["id"]; b_id = b.json()["shift"]["id"]
        TestShiftOverlapRepeat.created_ids += [a_id, b_id]

        # PATCH b to overlap with a → 409
        pr = merchant.patch(f"{BASE_URL}/api/staff/shifts/{b_id}", json={
            "start_time": "2026-07-07T09:00:00Z", "end_time": "2026-07-07T11:00:00Z",
        })
        assert pr.status_code == 409, pr.text

        # PATCH with ?force=true → 200
        pr2 = merchant.patch(f"{BASE_URL}/api/staff/shifts/{b_id}?force=true", json={
            "start_time": "2026-07-07T09:00:00Z", "end_time": "2026-07-07T11:00:00Z",
        })
        assert pr2.status_code == 200, pr2.text

    def test_shifts_repeat(self, merchant, staff):
        sid = staff["member"]["id"]
        # Use a unique-ish base week to avoid colliding with prior runs
        base_week = "2026-09-07"  # Monday
        # Create 2 shifts in source week
        s1 = merchant.post(f"{BASE_URL}/api/staff/shifts", json={
            "staff_id": sid, "title": "TEST_Iter90 Repeat1",
            "start_time": "2026-09-07T08:00:00Z", "end_time": "2026-09-07T12:00:00Z",
        })
        s2 = merchant.post(f"{BASE_URL}/api/staff/shifts", json={
            "staff_id": sid, "title": "TEST_Iter90 Repeat2",
            "start_time": "2026-09-09T14:00:00Z", "end_time": "2026-09-09T18:00:00Z",
        })
        assert s1.status_code == 200 and s2.status_code == 200
        TestShiftOverlapRepeat.created_ids += [s1.json()["shift"]["id"], s2.json()["shift"]["id"]]

        # First pre-clean any leftover dest shifts in next 2 weeks
        for week_off in (1, 2):
            base = (datetime(2026, 9, 7, tzinfo=timezone.utc) + timedelta(days=7 * week_off)).date()
            for day_off in range(0, 7):
                d = (base + timedelta(days=day_off)).isoformat()
                r = merchant.get(f"{BASE_URL}/api/staff/shifts?staff_id={sid}&start_date={d}&end_date={d}")
                if r.status_code == 200:
                    for s in r.json().get("shifts", []):
                        merchant.delete(f"{BASE_URL}/api/staff/shifts/{s['id']}")

        # Repeat for 2 weeks (skip_conflicts=true)
        rr = merchant.post(f"{BASE_URL}/api/staff/shifts/repeat", json={
            "week_start": base_week, "weeks": 2, "skip_conflicts": True,
        })
        assert rr.status_code == 200, rr.text
        body = rr.json()
        assert body["created"] == 4, f"expected 4 created, got {body}"
        assert body["skipped"] == 0

        # Track created shifts for cleanup
        for week_off in (1, 2):
            base = (datetime(2026, 9, 7, tzinfo=timezone.utc) + timedelta(days=7 * week_off)).date()
            for day_off in range(0, 7):
                d = (base + timedelta(days=day_off)).isoformat()
                r = merchant.get(f"{BASE_URL}/api/staff/shifts?staff_id={sid}&start_date={d}&end_date={d}")
                if r.status_code == 200:
                    for s in r.json().get("shifts", []):
                        if s.get("title", "").startswith("TEST_Iter90"):
                            TestShiftOverlapRepeat.created_ids.append(s["id"])

        # Repeat again with skip_conflicts=false → 409 (dest weeks now filled)
        rr2 = merchant.post(f"{BASE_URL}/api/staff/shifts/repeat", json={
            "week_start": base_week, "weeks": 1, "skip_conflicts": False,
        })
        assert rr2.status_code == 409, rr2.text

        # Repeat with skip_conflicts=true → 0 created, conflicts skipped
        rr3 = merchant.post(f"{BASE_URL}/api/staff/shifts/repeat", json={
            "week_start": base_week, "weeks": 1, "skip_conflicts": True,
        })
        assert rr3.status_code == 200
        assert rr3.json()["created"] == 0
        assert rr3.json()["skipped"] >= 2

    def test_repeat_bad_date_400(self, merchant):
        r = merchant.post(f"{BASE_URL}/api/staff/shifts/repeat", json={
            "week_start": "not-a-date", "weeks": 1,
        })
        assert r.status_code == 400

    def test_zzz_cleanup(self, merchant):
        # Final cleanup of any TEST_Iter90 shifts left behind via list endpoint
        # (best-effort, doesn't fail the test)
        self._cleanup(merchant)


# ─────────── Final cleanup of KB articles ───────────
def test_zzz_cleanup_kb(merchant_fixture=None):
    s = requests.Session()
    s.post(f"{BASE_URL}/api/auth/login", json={"email": MERCHANT_EMAIL, "password": MERCHANT_PW})
    # Delete all TEST_Iter90 articles
    r = s.get(f"{BASE_URL}/api/staff/knowledge/articles?q=TEST_Iter90")
    if r.status_code == 200:
        for a in r.json().get("articles", []):
            if a.get("title", "").startswith("TEST_Iter90"):
                s.delete(f"{BASE_URL}/api/staff/knowledge/articles/{a['id']}")
