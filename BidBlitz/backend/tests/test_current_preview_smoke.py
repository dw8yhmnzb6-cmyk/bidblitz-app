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
