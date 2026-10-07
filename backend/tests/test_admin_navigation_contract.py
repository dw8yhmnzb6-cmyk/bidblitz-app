"""Regression contract for the canonical Admin menu navigation."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_every_admin_menu_nav_destination_exists_in_app_router():
    sections = read("frontend/src/components/admin/sections.js")
    app = read("frontend/src/App.js")

    destinations = sorted(set(re.findall(r'nav:\s*"([^"]+)"', sections)))
    assert destinations, "Admin menu must expose real navigation destinations"

    missing = [route for route in destinations if f'case "{route}"' not in app]
    assert missing == [], f"Dead Admin navigation destinations: {missing}"


def test_coupon_manager_uses_live_canonical_route():
    sections = read("frontend/src/components/admin/sections.js")
    app = read("frontend/src/App.js")
    route_map = read("frontend/src/app/adminRouteMap.js")

    assert '{ key: "coupon-manager", icon: Gift, label: "Gutschein-Manager", nav: "/admin/coupons" }' in sections
    assert 'case "/admin/coupons":' in app
    assert 'coupons: "promos"' in route_map


def test_key_admin_sections_open_existing_manager_pages():
    sections = read("frontend/src/components/admin/sections.js")

    expected = {
        "staff": "/admin/employees",
        "enterprise": "/admin/enterprise",
        "influencer": "/admin/influencer",
        "admin-taxi": "/admin/taxi",
        "products": "/admin/products",
        "standard-auctions": "/admin/auctions",
        "winner-control": "/admin/winners",
        "system-health": "/admin/system-health",
        "database": "/admin/database",
    }
    for key, route in expected.items():
        assert re.search(rf'key:\s*"{re.escape(key)}"[^\n]*nav:\s*"{re.escape(route)}"', sections)


def test_admin_module_query_selection_tracks_route_changes():
    page = read("frontend/src/pages/AdminManagementPage.jsx")

    assert "const ModulesTab = ({ initialModule }) => {" in page
    assert "useEffect(() => {" in page
    assert "MODULE_DEFS.find((m) => m.key === initialModule) || null" in page
    assert "setSelectedMod(requested)" in page
    assert "}, [initialModule]);" in page


def test_live_ev_admin_uses_canonical_sources_and_stays_read_only():
    backend = read("backend/routes/admin_management.py")
    page = read("frontend/src/pages/AdminManagementPage.jsx")
    ladesaeulen = read("backend/routes/ladesaeulen.py")

    assert '"ladesaeulen": ("ev_stations", "name")' in backend
    assert 'if module_key == "ladesaeulen" and not TEST_MODE:' in backend
    assert '"collection": "ev_charge_points"' in backend
    assert '"read_only": True' in backend
    assert 'data-testid="module-read-only-note"' in page
    assert 'db.ev_stations.find' in ladesaeulen
    assert 'db.ev_charge_points.find' in ladesaeulen


def test_scooter_subscription_admin_and_customer_share_same_plan_source():
    backend = read("backend/routes/admin_management.py")
    scooter = read("backend/routes/scooter.py")
    page = read("frontend/src/pages/AdminManagementPage.jsx")

    create_segment = backend[backend.index('async def module_create'):backend.index('@router.get("/module/{module_key}/list")')]
    list_segment = backend[backend.index('async def module_list'):backend.index('@router.put("/module/{module_key}/{item_id}")')]

    assert "async def _get_scooter_plans()" in scooter
    assert "plans = await _get_scooter_plans()" in scooter
    assert 'await db.scooter_plans.find({}, {"_id": 0})' in scooter
    assert 'if row.get("enabled") is False:' in scooter
    assert 'if module_key == "scooter-abos":' in backend
    assert 'from routes.scooter import _get_scooter_plans' not in create_segment
    assert 'from routes.scooter import _coerce_scooter_plan' in create_segment
    assert 'from routes.scooter import _get_scooter_plans' in list_segment
    assert 'return {"items": items, "count": len(items), "collection": "scooter_plans"}' in list_segment
    assert '"enabled": False' in backend
    assert 'fields: ["plan_id", "name", "duration", "price", "duration_days", "unlock_fee", "free_minutes_per_day", "per_minute_rate"]' in page


def test_admin_service_crud_uses_same_collections_as_public_modules():
    backend = read("backend/routes/admin_management.py")

    assert '"reinigung": ("reinigung_services", "name")' in backend
    assert '"umzug": ("umzug_companies", "name")' in backend
    assert '"telemedizin": ("doctors", "name")' in backend
    assert '"fitness": ("gyms", "name")' in backend


def test_module_read_only_notice_stays_inside_module_crud_scope():
    page = read("frontend/src/pages/AdminManagementPage.jsx")

    customers = page[page.index("const CustomersTab = () => {"):page.index("const AuthHealthTab = () => {")]
    module_crud = page[page.index("const ModuleCRUD = ({ mod, onBack }) => {"):page.index("const ModuleForm = ({ mod, item, onClose, onSaved }) => {")]

    assert 'data-testid="module-read-only-note"' not in customers
    assert 'data-testid="module-read-only-note"' in module_crud
    assert '{readOnly && (' in module_crud
    assert 'readOnly ? "Keine Live-Daten vorhanden."' in module_crud


def test_admin_created_service_rows_receive_public_canonical_ids():
    backend = read("backend/routes/admin_management.py")

    expected = {
        "handwerker": "hw_id",
        "gebrauchtwagen": "car_id",
        "reinigung": "service_id",
        "umzug": "company_id",
        "tierbetreuung": "sitter_id",
        "streaming": "content_id",
        "telemedizin": "doctor_id",
        "fitness": "gym_id",
        "reisen": "trip_id",
    }
    for module_key, id_field in expected.items():
        assert f'"{module_key}": "{id_field}"' in backend
    assert "canonical_id_field = MODULE_ID_FIELDS.get(module_key)" in backend
    assert 'data[canonical_id_field] = data.get(canonical_id_field) or data["id"]' in backend


def test_admin_created_rows_are_visible_to_public_service_filters():
    backend = read("backend/routes/admin_management.py")

    assert 'elif module_key in {"handwerker", "tierbetreuung", "telemedizin"}:' in backend
    assert 'data["available"] = True if data.get("available") is None else bool(data.get("available"))' in backend
    assert 'elif module_key == "gebrauchtwagen":' in backend
    assert 'data["status"] = data.get("status") or "active"' in backend


def test_dating_admin_cannot_create_or_hard_delete_user_bound_profiles():
    backend = read("backend/routes/admin_management.py")
    page = read("frontend/src/pages/AdminManagementPage.jsx")

    delete_segment = backend[backend.index('async def module_delete'):backend.index('# ═══════════════════════════════════════════════════════════════\n# LIVE ANALYTICS')]

    assert 'if module_key == "dating":' in backend
    assert "Dating-Profile werden nur aus echten Nutzerkonten erstellt." in backend
    assert '"create_disabled": True' in backend
    assert '"create_disabled_reason": "Dating-Profile entstehen ausschließlich aus echten Nutzerkonten.' in backend
    assert '{"$set": {"active": False, "moderated_disabled_at": now}}' in delete_segment
    assert 'return {"ok": True, "disabled": True, "hard_deleted": False}' in delete_segment
    assert 'data-testid="module-create-disabled-note"' in page
    assert '{!readOnly && !createDisabled && (' in page
    assert 'const moderationOnly = mod.key === "dating";' in page
    assert 'item-disable-' in page
    assert '{!moderationOnly && (' in page


def test_reengage_admin_stays_preview_only_outside_test_mode():
    backend = read("backend/routes/reengage.py")
    page = read("frontend/src/pages/AdminManagementPage.jsx")

    assert '"actions_enabled": bool(TEST_MODE)' in backend
    assert '"provider_mode": "test" if TEST_MODE else "preview"' in backend
    assert "Re-Engagement-Wallet-Gutschriften und E-Mails sind in Production deaktiviert." in backend
    assert "preview.actions_enabled === false" in page
    assert 'data-testid="reengage-preview-only-note"' in page
    assert "Nur Preview – Aktionen deaktiviert" in page
    assert "preview.count === 0 || preview.actions_enabled === false" in page


def test_customer_admin_close_is_not_labeled_as_hard_delete():
    backend = read("backend/routes/admin_management.py")
    page = read("frontend/src/pages/AdminManagementPage.jsx")

    assert 'return {"ok": True, "closed": True, "hard_deleted": False}' in backend
    assert "Konto schließen" in page
    assert "Konto geschlossen" in page
    assert "Finanz- und Auditdaten bleiben erhalten" in page
    assert "Dauerhaft löschen" not in page


def test_admin_generic_refund_ui_matches_backend_safety_rules():
    backend = read("backend/routes/admin_management.py")
    page = read("frontend/src/pages/AdminManagementPage.jsx")

    assert '"refund",' in backend
    assert '"transfer",' in backend
    assert '"merchant_payment",' in backend
    assert '"stripe_topup",' in backend
    assert '"topup",' in backend
    assert "counterparty_user_id" in backend
    assert "recipient_id" in backend
    assert "merchant_id" in backend

    assert "GENERIC_REFUND_BLOCKED_TYPES" in page
    assert '"refund", "transfer", "merchant_payment", "merchant_payment_received"' in page
    assert "metadata.counterparty_user_id || metadata.recipient_id || metadata.merchant_id" in page
    assert '(!direction || direction === "debit")' in page
    assert 'currency === "EUR"' in page
    assert "const isRefundable = canGenericRefund(t);" in page


def test_admin_transactions_render_real_currency_codes():
    page = read("frontend/src/pages/AdminManagementPage.jsx")

    assert "const formatAdminTransactionAmount = (tx = {}) => {" in page
    assert 'currency === "EUR" ? `€${value}` : `${value} ${currency}`' in page
    assert "{formatAdminTransactionAmount(t)}" in page


def test_privileged_admin_auth_operations_require_privileged_manager():
    backend = read("backend/routes/admin_management.py")
    page = read("frontend/src/pages/AdminManagementPage.jsx")

    assert '"can_manage_privileged_roles": _can_manage_privileged_roles(admin)' in backend
    assert '{"role": {"$nin": ["admin", "super_admin"]}}' in backend
    assert "Nur Hauptadmin/Super-Admin darf privilegierte Auth-Daten verändern" in backend
    assert "Nur Hauptadmin/Super-Admin darf Passwort-Resets für privilegierte Konten auslösen" in backend

    assert "const [permissions, setPermissions]" in page
    assert "permissions={permissions}" in page
    assert "const canManagePrivileged = Boolean(permissions?.can_manage_privileged_roles);" in page
    assert "const privilegedActionBlocked = privilegedTarget && !canManagePrivileged;" in page
    assert 'data-testid="customer-privileged-action-note"' in page
    assert "disabled={loading || privilegedActionBlocked}" in page


def test_aggressive_auth_cleanup_requires_confirmation():
    page = read("frontend/src/pages/AdminManagementPage.jsx")

    assert 'mode === "aggressive"' in page
    assert "Aggressive Auth-Bereinigung wirklich ausführen?" in page
    assert "Nur nicht-privilegierte Kundenkonten werden verarbeitet." in page


def test_banned_customers_remain_visible_in_admin_filters():
    backend = read("backend/routes/admin_management.py")

    start = backend.index('@router.get("/customers")')
    end = backend.index('@router.get("/customers/{user_id}")', start)
    handler = backend[start:end]

    assert '{"account_closure_status": {"$ne": "admin_closed"}}' in handler
    assert '{"banned": True}' in handler
    assert '"is_disabled": {"$ne": True}' in handler
    assert 'if status == "banned":' in handler
    assert 'query["$and"].append({"banned": True})' in handler
    active_block = handler[handler.index('elif status == "active":'):]
    assert '{"banned": {"$ne": True}}' in active_block
    assert '"login_disabled": {"$ne": True}' in active_block


def test_privileged_kyc_decisions_require_privileged_manager():
    backend = read("backend/routes/admin_management.py")
    page = read("frontend/src/pages/AdminManagementPage.jsx")

    assert "Nur Hauptadmin/Super-Admin darf KYC privilegierter Konten ändern" in backend
    assert 'target_role in {"admin", "super_admin"}' in backend
    assert 'disabled={loading || privilegedActionBlocked || customer.kyc_status === "approved"}' in page
    assert 'disabled={loading || privilegedActionBlocked || customer.kyc_status === "rejected"}' in page


def test_admin_password_reset_form_stays_open_on_delivery_failure():
    page = read("frontend/src/pages/AdminManagementPage.jsx")

    assert "return true;" in page
    assert "return false;" in page
    assert "const resetPw = async () => {" in page
    assert "const ok = await doAction(" in page
    assert "if (ok) setShowPwForm(false);" in page


def test_super_admin_uses_same_admin_route_gates():
    app = read("frontend/src/App.js")
    admin_page = read("frontend/src/pages/AdminPage.jsx")

    assert 'const isAdminRole = ["admin", "super_admin"].includes(user?.role);' in app
    assert 'if (path === "/admin" && (!user.isAuthenticated || !isAdminRole))' in app
    assert 'return isAdminRole ? <AdminPage' in app
    assert 'return isAdminRole ? <AdminManagementPage' in app
    assert 'return isAdminRole ? <AdminWalletPage' in app
    assert 'return isAdminRole ? <AdminMobilityPricingPage' in app
    assert 'user.role === "admin" ? <Admin' not in app
    assert 'case "/admin/ai-assistant":' in app
    assert 'return user.role === "admin"' in app
    assert 'if (!["admin", "super_admin"].includes(user.role)) {' in admin_page


def test_admin_promotions_use_canonical_error_and_role_handling():
    backend = read("backend/routes/promotions.py")
    router = read("frontend/src/components/AdminTabRouter.jsx")

    assert backend.count('user.get("role") not in ("admin", "super_admin")') >= 3
    assert 'user.get("role") != "admin"' not in backend
    assert 'request as apiRequest' in router
    assert 'apiRequest("/api/promotions/admin/create"' in router
    assert 'normalized_name = req.name.strip()' in backend
    assert 'Promotion name already exists' in backend
    assert 'match_count = await db.promotions.count_documents({"name": promo_name})' in backend
    assert 'Promotion name is ambiguous; duplicate records require admin cleanup' in backend
    assert 'Promotion changed concurrently; reload and retry' in backend
    assert 'encodeURIComponent(p.name)' in router
    assert 'fetch(`${API}/api/promotions/admin/create`' not in router


def test_super_admin_is_accepted_by_changed_admin_backends():
    approvals = read("backend/routes/admin_approvals.py")
    grants = read("backend/routes/admin_grants.py")
    merchant_admin = read("backend/routes/merchant_admin.py")

    assert 'user.get("role") not in ("admin", "super_admin")' in approvals
    assert 'user.get("role") != "admin"' not in approvals

    assert grants.count('admin.get("role") not in ("admin", "super_admin")') >= 5
    assert 'admin.get("role") != "admin"' not in grants

    assert 'user.get("role") not in {"admin", "super_admin"}' in merchant_admin
    assert 'user.get("role") not in {"merchant", "admin", "super_admin"}' in merchant_admin
    assert 'user.get("role") != "admin"' not in merchant_admin


def test_admin_health_counts_super_admins():
    backend = read("backend/routes/admin.py")
    assert 'health["counts"]["admins"] = await db.users.count_documents({"role": {"$in": ["admin", "super_admin"]}})' in backend


def test_admin_user_list_labels_super_admin_accounts():
    router = read("frontend/src/components/AdminTabRouter.jsx")

    assert '["admin", "super_admin"].includes(u.role)' in router
    assert 'u.role === "super_admin" ? "Super Admin" : "Admin"' in router


def test_taxi_admin_routes_accept_super_admin():
    taxi = read("backend/routes/taxi.py")

    assert 'user.get("role") != "admin"' not in taxi
    assert taxi.count('user.get("role") not in ("admin", "super_admin")') >= 12


def test_admin_actions_surface_api_failures():
    router = read("frontend/src/components/AdminTabRouter.jsx")

    assert 'import { toast } from "sonner";' in router
    assert 'Promotion konnte nicht erstellt werden.' in router
    assert 'Gebühren konnten nicht gespeichert werden.' in router
    assert 'Händlergebühren konnten nicht gespeichert werden.' in router
    assert 'Promotion konnte nicht geändert werden.' in router
    assert 'Feature-Flag konnte nicht geändert werden.' in router
    assert 'Compliance-Flag konnte nicht aufgelöst werden.' in router
    assert '.catch(() => {})' not in router


def test_compliance_resolve_uses_stable_flag_ids():
    backend = read("backend/routes/admin.py")
    router = read("frontend/src/components/AdminTabRouter.jsx")

    assert 'flag["flag_id"] = str(mongo_id)' in backend
    assert '@router.post("/compliance-flags/{flag_ref}/resolve")' in backend
    assert 'if ObjectId.is_valid(flag_ref):' in backend
    assert '{"_id": flag["_id"], "status": "open"}' in backend
    assert "Flag wurde bereits verarbeitet; bitte neu laden" in backend
    assert 'flag_id": str(flag["_id"])' in backend
    assert 'disabled={!flag.flag_id}' in router
    assert 'if (!flag.flag_id)' in router
    assert 'Compliance-Flag hat keine stabile ID. Bitte neu laden.' in router
    assert 'encodeURIComponent(flag.flag_id)' in router
    assert 'flag.flag_id || String(i)' not in router
