import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"
REVIEWER_EMAIL = "reviewer@bidblitz.ae"
REVIEWER_PASSWORD = "BidBlitzReview2026!"


def test_health_and_auth_smoke():
    assert BASE_URL, "REACT_APP_BACKEND_URL is required"

    health = requests.get(f"{BASE_URL}/api/health", timeout=20)
    assert health.status_code == 200

    admin = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert admin.status_code == 200, admin.text

    reviewer = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": REVIEWER_EMAIL, "password": REVIEWER_PASSWORD},
        timeout=20,
    )
    assert reviewer.status_code == 200, reviewer.text


def test_mining_dashboard_read_only_smoke():
    assert BASE_URL, "REACT_APP_BACKEND_URL is required"

    session = requests.Session()
    login = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": REVIEWER_EMAIL, "password": REVIEWER_PASSWORD},
        timeout=20,
    )
    assert login.status_code == 200, login.text

    capabilities = session.get(f"{BASE_URL}/api/mining/capabilities", timeout=20)
    assert capabilities.status_code == 200, capabilities.text
    cap = capabilities.json()
    assert "value_actions_enabled" in cap
    assert "live_mining_provider_connected" in cap

    packages = session.get(f"{BASE_URL}/api/mining/packages", timeout=20)
    assert packages.status_code == 200, packages.text
    pkg = packages.json()
    assert isinstance(pkg.get("packages"), list)
    assert "capabilities" in pkg

    dashboard = session.get(f"{BASE_URL}/api/mining/dashboard", timeout=20)
    assert dashboard.status_code == 200, dashboard.text
    data = dashboard.json()
    assert "capabilities" in data
    assert "wallet" in data
    assert "mining" in data
    assert "vip" in data
    assert isinstance(data.get("miners"), list)
    assert isinstance(data.get("recent_transactions"), list)
