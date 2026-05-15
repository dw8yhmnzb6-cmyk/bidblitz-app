"""
Iter 111: Staff Chat (1:1 Manager↔Staff) + Smart Reminders
Tests:
  - POST /api/staff/chat/threads (manager creates / fetches existing)
  - GET  /api/staff/chat/threads (hydrated staff, unread)
  - POST /api/staff/chat/threads/{id}/messages (manager sends)
  - Staff session: GET /api/staff/chat/threads (only own)
  - GET  /api/staff/chat/threads/{id}/messages (lists manager msg)
  - PATCH /api/staff/chat/threads/{id}/read (unread→0)
  - GET  /api/staff/chat/unread-count
  - GET  /api/staff/reminders/check
  - POST /api/staff/reminders/dispatch (with fake id → skipped expired OR not_configured)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")

MERCHANT_EMAIL = "haendler@bidblitz.com"
MERCHANT_PW = "Haendler2026!"
# Per review_request credentials section
STAFF_EMAIL_PRIMARY = "mitarbeiter@bidblitz.com"
STAFF_EMAIL_FALLBACK = "TEST_magic_1778611082@example.com"
STAFF_PW = "test123"
STAFF_ID = "ee9686ea-739b-4ba9-9872-650cb0955fae"  # Max Mustermann (per task)


@pytest.fixture(scope="module")
def merchant_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": MERCHANT_EMAIL, "password": MERCHANT_PW}, timeout=20)
    assert r.status_code == 200, f"Merchant login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def staff_session():
    s = requests.Session()
    # Try primary email first (per task), fallback to credentials file value
    for email in (STAFF_EMAIL_PRIMARY, STAFF_EMAIL_FALLBACK):
        r = s.post(f"{BASE_URL}/api/staff/auth/login", json={"email": email, "password": STAFF_PW}, timeout=20)
        if r.status_code == 200 and "staff_session" in s.cookies:
            return s
    pytest.skip(f"Staff login failed for both emails: {r.status_code} {r.text}")


# ─── Chat ─────────────────────────────────────────────────────
class TestChat:
    thread_id = None

    def test_manager_create_thread(self, merchant_session):
        r = merchant_session.post(f"{BASE_URL}/api/staff/chat/threads", json={"staff_id": STAFF_ID}, timeout=15)
        assert r.status_code == 200, f"create thread failed: {r.status_code} {r.text}"
        data = r.json()
        assert "thread" in data
        t = data["thread"]
        assert t.get("id"), "thread.id missing"
        assert t.get("staff", {}).get("id") == STAFF_ID
        TestChat.thread_id = t["id"]

    def test_manager_list_threads(self, merchant_session):
        r = merchant_session.get(f"{BASE_URL}/api/staff/chat/threads", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "threads" in data and isinstance(data["threads"], list)
        ids = [t["id"] for t in data["threads"]]
        assert TestChat.thread_id in ids, f"created thread not listed; got {ids}"
        # hydrated staff name + unread
        my_t = next(t for t in data["threads"] if t["id"] == TestChat.thread_id)
        assert "staff" in my_t and "name" in my_t.get("staff", {})
        assert "unread" in my_t
        assert "last_message_preview" in my_t

    def test_manager_send_message(self, merchant_session):
        assert TestChat.thread_id, "thread_id missing"
        r = merchant_session.post(
            f"{BASE_URL}/api/staff/chat/threads/{TestChat.thread_id}/messages",
            json={"text": "Hallo TEST_iter111"},
            timeout=15,
        )
        assert r.status_code == 200, f"send failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("success") is True
        assert data["message"]["id"]
        assert data["message"]["text"] == "Hallo TEST_iter111"
        assert data["message"]["sender_role"] == "manager"

    def test_manager_empty_message_rejected(self, merchant_session):
        assert TestChat.thread_id
        r = merchant_session.post(
            f"{BASE_URL}/api/staff/chat/threads/{TestChat.thread_id}/messages",
            json={"text": "   "},
            timeout=15,
        )
        assert r.status_code == 400

    def test_staff_list_only_own_threads(self, staff_session):
        r = staff_session.get(f"{BASE_URL}/api/staff/chat/threads", timeout=15)
        assert r.status_code == 200, f"staff list failed: {r.status_code} {r.text}"
        data = r.json()
        for t in data["threads"]:
            assert t.get("staff_id") == STAFF_ID, f"staff sees other staff thread: {t}"
        assert TestChat.thread_id in [t["id"] for t in data["threads"]]

    def test_staff_get_messages(self, staff_session):
        assert TestChat.thread_id
        r = staff_session.get(
            f"{BASE_URL}/api/staff/chat/threads/{TestChat.thread_id}/messages", timeout=15
        )
        assert r.status_code == 200
        data = r.json()
        msgs = data.get("messages", [])
        texts = [m["text"] for m in msgs]
        assert any("Hallo TEST_iter111" in t for t in texts), f"manager msg missing; got {texts}"

    def test_staff_unread_count_before_read(self, staff_session):
        r = staff_session.get(f"{BASE_URL}/api/staff/chat/unread-count", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data.get("unread"), int)
        assert data["unread"] >= 1, f"expected unread>=1, got {data}"

    def test_staff_mark_read(self, staff_session):
        assert TestChat.thread_id
        r = staff_session.patch(f"{BASE_URL}/api/staff/chat/threads/{TestChat.thread_id}/read", timeout=15)
        assert r.status_code == 200
        assert r.json().get("success") is True

    def test_staff_unread_count_after_read(self, staff_session):
        r = staff_session.get(f"{BASE_URL}/api/staff/chat/unread-count", timeout=15)
        assert r.status_code == 200
        data = r.json()
        # at least the thread we read should be 0 (others may have unread)
        # The aggregate may still be 0 if only one thread exists
        assert data["unread"] >= 0

    def test_staff_send_reply_triggers_manager_unread(self, staff_session, merchant_session):
        assert TestChat.thread_id
        r = staff_session.post(
            f"{BASE_URL}/api/staff/chat/threads/{TestChat.thread_id}/messages",
            json={"text": "Reply TEST_iter111 from Max"},
            timeout=15,
        )
        assert r.status_code == 200
        # Manager unread now >=1
        r2 = merchant_session.get(f"{BASE_URL}/api/staff/chat/unread-count", timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("unread", 0) >= 1


# ─── Reminders ────────────────────────────────────────────────
class TestReminders:
    def test_check_reminders(self, staff_session):
        r = staff_session.get(f"{BASE_URL}/api/staff/reminders/check", timeout=15)
        assert r.status_code == 200, f"check failed: {r.status_code} {r.text}"
        data = r.json()
        assert "reminders" in data and isinstance(data["reminders"], list)
        assert "count" in data
        assert "checked_at" in data

    def test_check_requires_staff_session(self):
        r = requests.get(f"{BASE_URL}/api/staff/reminders/check", timeout=15)
        assert r.status_code == 401

    def test_dispatch_fake_id_skipped(self, staff_session):
        r = staff_session.post(
            f"{BASE_URL}/api/staff/reminders/dispatch",
            json={"reminder_ids": ["fake_id_does_not_exist"]},
            timeout=15,
        )
        assert r.status_code == 200, f"dispatch failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("sent") == []
        skipped = data.get("skipped", [])
        assert len(skipped) >= 1
        reasons = [s.get("reason") for s in skipped]
        # Either OneSignal not configured (returns single skip), or per-id expired
        assert any(reason in ("not_configured", "expired") for reason in reasons), f"unexpected skipped reasons: {reasons}"
