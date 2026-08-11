from pathlib import Path
from uuid import uuid4

import pytest
import requests


MERCHANT_EMAIL = "haendler@bidblitz.ae"
MERCHANT_PASSWORD = "Haendler2026!"
ADMIN_EMAIL = "admin@bidblitz.ae"
ADMIN_PASSWORD = "BidBlitz2026!"
STAFF_EMAIL = "mitarbeiter@bidblitz.ae"
STAFF_PASSWORD = "test123"


def resolve_base_url() -> str:
    env_url = ""
    frontend_env = Path("/app/frontend/.env")
    if frontend_env.exists():
        for line in frontend_env.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                env_url = line.split("=", 1)[1].strip()
                break
    return env_url.rstrip("/")


BASE_URL = resolve_base_url()


def login(email: str, password: str) -> requests.Session:
    session = requests.Session()
    response = session.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if response.status_code != 200:
        pytest.skip(f"Login fehlgeschlagen für {email}: {response.status_code} - {response.text}")
    return session


@pytest.fixture(scope="module")
def merchant_session():
    return login(MERCHANT_EMAIL, MERCHANT_PASSWORD)


@pytest.fixture(scope="module")
def staff_session():
    return login(STAFF_EMAIL, STAFF_PASSWORD)


@pytest.fixture(scope="module")
def pos_context(merchant_session):
    state = merchant_session.get(f"{BASE_URL}/api/merchant-setup/state")
    assert state.status_code == 200, state.text
    payload = state.json()
    store = (payload.get("stores") or [None])[0]
    register = (payload.get("registers") or [None])[0]
    assert store and register, "Store/Register für POS-Test fehlen"

    shift_res = merchant_session.get(f"{BASE_URL}/api/pos/shift/current", params={"register_id": register["register_id"]})
    assert shift_res.status_code == 200, shift_res.text
    if not shift_res.json().get("shift"):
        open_res = merchant_session.post(f"{BASE_URL}/api/pos/shift/open", json={"register_id": register["register_id"], "opening_cash": 0})
        assert open_res.status_code == 200, open_res.text

    products = merchant_session.get(f"{BASE_URL}/api/pos/products/search", params={"store_id": store["store_id"], "limit": 10})
    assert products.status_code == 200, products.text
    product_list = products.json().get("products") or []
    product = next((item for item in product_list if not item.get("track_stock") or float(item.get("stock", 0)) >= 1), None)
    if not product:
        create_res = merchant_session.post(
            f"{BASE_URL}/api/pos/products/create",
            json={
                "store_id": store["store_id"],
                "name": f"POS QA {uuid4().hex[:6]}",
                "price": 3.5,
                "tax_rate": 0.19,
                "category": "QA",
                "track_stock": False,
                "stock": 0,
            },
        )
        assert create_res.status_code == 200, create_res.text
        product = create_res.json().get("product")

    progress = payload.get("progress") or {}
    payment_methods = dict(progress.get("payment_methods") or {})
    payment_methods["cash"] = "enabled"
    payment_methods["qr"] = "enabled"
    payment_methods["wallet"] = "enabled"
    setup_save = merchant_session.put(
        f"{BASE_URL}/api/merchant-setup/state",
        json={
            "current_step": progress.get("current_step") or "fertig",
            "completed_steps": progress.get("completed_steps") or [],
            "onboarding_percentage": progress.get("onboarding_percentage") or 100,
            "business_info": progress.get("business_info") or {},
            "business_type": progress.get("business_type") or "Einzelhandel",
            "product_setup": progress.get("product_setup") or {},
            "payment_methods": payment_methods,
            "devices": progress.get("devices") or {},
            "staff_setup": progress.get("staff_setup") or {},
            "activation_status": progress.get("activation_status") or "ready",
        },
    )
    assert setup_save.status_code == 200, setup_save.text

    return {"store": store, "register": register, "product": product}


def create_cart(session: requests.Session, register_id: str, product_id: str):
    response = session.post(
        f"{BASE_URL}/api/pos/cart/create",
        json={
            "register_id": register_id,
            "items": [{"product_id": product_id, "quantity": 1}],
            "discount_pct": 0,
            "customer_note": "POS Acceptance QA",
        },
    )
    assert response.status_code == 200, response.text
    return response.json().get("cart", {})


def test_pending_wallet_payment_reuses_existing_attempt(merchant_session, pos_context):
    cart = create_cart(merchant_session, pos_context["register"]["register_id"], pos_context["product"]["product_id"])
    first = merchant_session.post(f"{BASE_URL}/api/pos/payment/create", json={"cart_id": cart["cart_id"], "method": "wallet_qr"})
    assert first.status_code == 200, first.text
    first_data = first.json()
    assert first_data.get("awaiting_customer") is True
    second = merchant_session.post(f"{BASE_URL}/api/pos/payment/create", json={"cart_id": cart["cart_id"], "method": "wallet_qr"})
    assert second.status_code == 200, second.text
    second_data = second.json()
    assert second_data.get("status") == "pending_existing"
    assert second_data.get("payment", {}).get("payment_id") == first_data.get("payment", {}).get("payment_id")


def test_paid_cart_cannot_be_charged_twice(merchant_session, pos_context):
    cart = create_cart(merchant_session, pos_context["register"]["register_id"], pos_context["product"]["product_id"])
    paid = merchant_session.post(f"{BASE_URL}/api/pos/payment/create", json={"cart_id": cart["cart_id"], "method": "cash", "cash_received": cart.get("total", 0)})
    assert paid.status_code == 200, paid.text
    paid_data = paid.json()
    assert paid_data.get("sale", {}).get("receipt_id")
    replay = merchant_session.post(f"{BASE_URL}/api/pos/payment/create", json={"cart_id": cart["cart_id"], "method": "cash", "cash_received": cart.get("total", 0)})
    assert replay.status_code == 200, replay.text
    replay_data = replay.json()
    assert replay_data.get("status") == "already_paid"
    assert replay_data.get("payment", {}).get("payment_id") == paid_data.get("payment", {}).get("payment_id")


def test_pending_payment_status_endpoint_returns_pending(merchant_session, pos_context):
    cart = create_cart(merchant_session, pos_context["register"]["register_id"], pos_context["product"]["product_id"])
    created = merchant_session.post(f"{BASE_URL}/api/pos/payment/create", json={"cart_id": cart["cart_id"], "method": "wallet_qr"})
    assert created.status_code == 200, created.text
    payment_id = created.json().get("payment", {}).get("payment_id")
    status = merchant_session.get(f"{BASE_URL}/api/pos/payment/status/{payment_id}")
    assert status.status_code == 200, status.text
    assert status.json().get("status") == "pending"


def test_staff_cannot_access_merchant_finance_endpoints(staff_session):
    balance = staff_session.get(f"{BASE_URL}/api/merchant/balance")
    assert balance.status_code in {403, 404}, balance.text
    settlements = staff_session.get(f"{BASE_URL}/api/admin/merchant-settlements")
    assert settlements.status_code in {403, 404}, settlements.text