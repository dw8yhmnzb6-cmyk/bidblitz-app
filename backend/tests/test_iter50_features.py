"""
Iter50 P2 batch — Backend tests
- Extended chatbot analytics
- CSV leads export
- Sales-invite (LiveKit room + Resend email)
- LiveKit recordings list/upload/download (GridFS)
"""
import os
import io
import csv
import secrets
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ocpp-csms-platform.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.com"
ADMIN_PASS = "BidBlitz2026!"
USER_EMAIL = "kunde@bidblitz.com"
USER_PASS = "Kunde2026!"


def _login(email: str, password: str) -> requests.Session:
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text[:200]}"
    return s


@pytest.fixture(scope="session")
def admin_session():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="session")
def user_session():
    return _login(USER_EMAIL, USER_PASS)


# ──────────────── Chatbot Analytics ────────────────
class TestChatbotAnalytics:
    def test_analytics_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/landing-chatbot/analytics", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["total_sessions", "total_messages", "total_leads", "conversion_rate",
                  "messages_per_day", "top_topics", "unique_lead_emails"]:
            assert k in d, f"missing key {k}"
        assert isinstance(d["messages_per_day"], list)
        assert isinstance(d["top_topics"], list)
        assert isinstance(d["total_sessions"], int)
        assert isinstance(d["conversion_rate"], (int, float))

    def test_analytics_non_admin_forbidden(self, user_session):
        r = user_session.get(f"{BASE_URL}/api/landing-chatbot/analytics", timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text[:200]}"

    def test_analytics_unauth(self):
        r = requests.get(f"{BASE_URL}/api/landing-chatbot/analytics", timeout=30)
        assert r.status_code in (401, 403)


# ──────────────── CSV Export ────────────────
class TestLeadsExport:
    def test_export_admin(self, admin_session):
        # Seed a known lead first to ensure CSV has content
        seed = {"email": f"TEST_iter50_{secrets.token_hex(4)}@example.com",
                "name": "Iter50 Tester", "interest": "demo"}
        cap = requests.post(f"{BASE_URL}/api/landing-chatbot/leads", json=seed, timeout=30)
        assert cap.status_code == 200

        r = admin_session.get(f"{BASE_URL}/api/landing-chatbot/leads/export", timeout=30)
        assert r.status_code == 200, r.text
        assert "text/csv" in r.headers.get("content-type", "")
        assert "attachment" in r.headers.get("content-disposition", "").lower()
        assert "bidblitz-leads-" in r.headers.get("content-disposition", "")

        # parse CSV
        rows = list(csv.reader(io.StringIO(r.text)))
        assert len(rows) >= 1
        header = rows[0]
        for col in ["email", "name", "interest", "source"]:
            assert col in header, f"missing col {col}"
        # seeded email present
        emails = [row[0] for row in rows[1:]]
        assert seed["email"] in emails, "seeded lead not in export"

    def test_export_non_admin(self, user_session):
        r = user_session.get(f"{BASE_URL}/api/landing-chatbot/leads/export", timeout=30)
        assert r.status_code == 403


# ──────────────── Sales Invite ────────────────
class TestSalesInvite:
    def test_sales_invite_admin(self, admin_session):
        # Seed a lead to update
        lead_email = f"TEST_iter50_sales_{secrets.token_hex(4)}@example.com"
        requests.post(f"{BASE_URL}/api/landing-chatbot/leads",
                      json={"email": lead_email, "name": "Sales Lead", "interest": "demo"},
                      timeout=30)

        r = admin_session.post(
            f"{BASE_URL}/api/landing-chatbot/leads/sales-invite",
            json={"email": lead_email, "lead_name": "Sales Lead", "custom_message": "Hi from iter50"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert d.get("room_name", "").startswith("sales-")
        assert d.get("lead_email") == lead_email
        assert "join_url" in d
        assert "email_sent" in d  # bool, may be False for fake address — OK

        # verify livekit_rooms got created — by listing rooms
        rl = admin_session.get(f"{BASE_URL}/api/livekit/rooms", timeout=30)
        assert rl.status_code == 200
        names = [x.get("room_name") for x in rl.json().get("rooms", [])]
        assert d["room_name"] in names, "sales room not in livekit_rooms list"

    def test_sales_invite_non_admin(self, user_session):
        r = user_session.post(
            f"{BASE_URL}/api/landing-chatbot/leads/sales-invite",
            json={"email": "x@example.com"},
            timeout=30,
        )
        assert r.status_code == 403


# ──────────────── LiveKit Recordings ────────────────
class TestRecordings:
    def test_list_recordings_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/livekit/recordings", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "recordings" in d and "total" in d
        assert isinstance(d["recordings"], list)

    def test_list_recordings_user(self, user_session):
        r = user_session.get(f"{BASE_URL}/api/livekit/recordings", timeout=30)
        assert r.status_code == 200

    def test_upload_and_download_recording(self, admin_session):
        # Create room
        room_name = f"rec-test-{secrets.token_hex(4)}"
        rc = admin_session.post(f"{BASE_URL}/api/livekit/rooms",
                                json={"room_name": room_name}, timeout=30)
        assert rc.status_code == 200, rc.text

        # Start recording
        rs = admin_session.post(
            f"{BASE_URL}/api/livekit/rooms/{room_name}/recording/start",
            json={"room_name": room_name},
            timeout=30,
        )
        assert rs.status_code == 200, rs.text
        rec_id = rs.json()["recording_id"]

        # Upload blob (raw bytes)
        fake_webm = b"\x1a\x45\xdf\xa3" + b"FAKE_WEBM_BLOB_" * 100  # 1500+ bytes
        up = admin_session.post(
            f"{BASE_URL}/api/livekit/rooms/{room_name}/recording/upload",
            params={"recording_id": rec_id},
            data=fake_webm,
            headers={"Content-Type": "application/octet-stream"},
            timeout=60,
        )
        assert up.status_code == 200, up.text
        ud = up.json()
        assert ud["ok"] is True
        assert ud["recording_id"] == rec_id
        assert ud["size_bytes"] == len(fake_webm)
        assert "file_id" in ud

        # List filtered by room
        lst = admin_session.get(f"{BASE_URL}/api/livekit/recordings",
                                params={"room_name": room_name}, timeout=30)
        assert lst.status_code == 200
        recs = lst.json()["recordings"]
        assert any(r["recording_id"] == rec_id and r.get("status") == "uploaded" for r in recs)

        # Download
        dl = admin_session.get(f"{BASE_URL}/api/livekit/recordings/{rec_id}/download",
                               timeout=30)
        assert dl.status_code == 200
        assert dl.headers.get("content-type", "").startswith("video/webm")
        assert dl.content == fake_webm

    def test_download_nonexistent_returns_404(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/livekit/recordings/REC_DOESNOTEXIST/download",
                              timeout=30)
        assert r.status_code == 404

    def test_upload_empty_body_400(self, admin_session):
        room_name = f"rec-empty-{secrets.token_hex(3)}"
        admin_session.post(f"{BASE_URL}/api/livekit/rooms",
                           json={"room_name": room_name}, timeout=30)
        rs = admin_session.post(
            f"{BASE_URL}/api/livekit/rooms/{room_name}/recording/start",
            json={"room_name": room_name}, timeout=30,
        )
        rec_id = rs.json()["recording_id"]
        up = admin_session.post(
            f"{BASE_URL}/api/livekit/rooms/{room_name}/recording/upload",
            params={"recording_id": rec_id},
            data=b"",
            timeout=30,
        )
        assert up.status_code == 400


# ──────────────── Iter46/48 regression smoke ────────────────
class TestRegression:
    def test_livekit_token(self, admin_session):
        room_name = f"reg-room-{secrets.token_hex(3)}"
        admin_session.post(f"{BASE_URL}/api/livekit/rooms", json={"room_name": room_name}, timeout=30)
        r = admin_session.post(f"{BASE_URL}/api/livekit/token",
                               json={"room_name": room_name, "is_publisher": True}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d.get("participant_token") and d.get("server_url")

    def test_chatbot_health(self):
        r = requests.get(f"{BASE_URL}/api/landing-chatbot/health", timeout=20)
        assert r.status_code == 200

    def test_admin_only_leads(self, user_session):
        r = user_session.get(f"{BASE_URL}/api/landing-chatbot/leads", timeout=30)
        assert r.status_code == 403
