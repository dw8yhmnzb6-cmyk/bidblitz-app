from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Body, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.investor_portal_auth import get_current_investor_account
from core.rate_limit import RATE_ADMIN_ACTION, limiter
from core.security import get_current_user

router = APIRouter(prefix="/api/master-roadmap", tags=["master-roadmap"])

BASE_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = BASE_DIR / "frontend"
IOS_ROOT_PUBLIC_DIR = BASE_DIR / "ios" / "App" / "App" / "public"
IOS_FRONTEND_PUBLIC_DIR = FRONTEND_DIR / "ios" / "App" / "App" / "public"
FRONTEND_BUILD_DIR = FRONTEND_DIR / "build"
BUILD_INFO_PATH = Path(__file__).resolve().parent.parent / "build_info.json"
SCHEMA_VERSION = "final-completion-phase-v1"

STATUS_ORDER = [
    "Backlog",
    "Ready",
    "In Progress",
    "Blocked",
    "In Review",
    "Testing",
    "Manual Approval",
    "Ready for Release",
    "Completed",
    "Rejected",
]
PRIORITY_ORDER = ["P0 Critical", "P1 Required", "P2 Important", "P3 Later"]
GATE_STATUS_ORDER = ["verified", "incomplete", "blocked", "manual-approval"]
PHASES = [
    {"phase_id": "phase-1", "title": "PHASE 1 – P0 LAUNCH BLOCKERS", "priority": "P0", "description": "Kritische Beta-Blocker vor jeder Release-Freigabe schließen.", "sort_order": 1},
    {"phase_id": "phase-2", "title": "PHASE 2 – CORE USER FLOWS", "priority": "P1", "description": "Alle Kernnutzerflüsse vollständig stabilisieren.", "sort_order": 2},
    {"phase_id": "phase-3", "title": "PHASE 3 – MERCHANT AND ADMIN", "priority": "P1", "description": "Merchant- und Admin-Bereiche crash-sicher und release-fähig machen.", "sort_order": 3},
    {"phase_id": "phase-4", "title": "PHASE 4 – MOBILE QUALITY", "priority": "P1", "description": "Responsive- und UI-Qualität auf allen Ziel-Viewports absichern.", "sort_order": 4},
    {"phase_id": "phase-5", "title": "PHASE 5 – TRANSLATION AUDIT", "priority": "P1", "description": "Alle aktiven Seiten in allen Sprachen auditieren.", "sort_order": 5},
    {"phase_id": "phase-6", "title": "PHASE 6 – STORE SAFE RELEASE", "priority": "P1", "description": "Store-sichere Mobile-Konfiguration mit klarer Modulgrenze liefern.", "sort_order": 6},
    {"phase_id": "phase-7", "title": "PHASE 7 – RELEASE ARTIFACTS", "priority": "P1", "description": "Web-, iOS- und Android-Release-Artefakte ehrlich vorbereiten.", "sort_order": 7},
    {"phase_id": "phase-8", "title": "PHASE 8 – FINAL ACCEPTANCE REPORT", "priority": "P1", "description": "Abschlussstatus, Beta-Readiness und offene Blocker transparent berichten.", "sort_order": 8},
]


class TaskPatchRequest(BaseModel):
    status: Optional[str] = None
    responsible_role: Optional[str] = None
    completion_percentage: Optional[int] = Field(default=None, ge=0, le=100)
    start_date: Optional[str] = None
    target_date: Optional[str] = None
    notes: Optional[str] = None


class FeatureRegistryPatchRequest(BaseModel):
    enabled_in_development: Optional[bool] = None
    enabled_in_test: Optional[bool] = None
    enabled_in_staging: Optional[bool] = None
    enabled_in_web_production: Optional[bool] = None
    enabled_in_ios: Optional[bool] = None
    enabled_in_android: Optional[bool] = None
    store_safe: Optional[bool] = None
    requires_kyc: Optional[bool] = None
    requires_payment_license: Optional[bool] = None
    requires_manual_approval: Optional[bool] = None
    notes: Optional[str] = None


class ReleaseGatePatchRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    recorded_value: Optional[str] = None


async def _require_admin(request: Request) -> dict[str, Any]:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin Zugriff erforderlich")
    return user


async def _allow_investor_view(request: Request) -> dict[str, Any]:
    try:
        user = await get_current_user(request)
        if user.get("role") in {"admin", "investor", "reviewer"}:
            return user
    except Exception:
        pass
    try:
        account = await get_current_investor_account(request)
        return account
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Investor Fortschritt erfordert freigegebenen Zugriff.") from exc


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_json(path: Path) -> dict[str, Any]:
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return {}


def _build_info() -> dict[str, Any]:
    return _safe_json(BUILD_INFO_PATH)


def _read_env_file(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    data: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value.strip()
    return data


def _task(
    task_id: str,
    title: str,
    description: str,
    phase: str,
    priority: str,
    responsible_role: str,
    status: str,
    effort: str,
    target_offset_days: int,
    frontend_files: list[str],
    backend_files: list[str],
    api_routes: list[str],
    test_requirements: list[str],
    acceptance_criteria: list[str],
    security_impact: str,
    financial_impact: str,
    release_risk: str,
    dependencies: Optional[list[str]] = None,
    completion_percentage: int = 0,
    notes: str = "",
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    return {
        "task_id": task_id,
        "title": title,
        "description": description,
        "phase": phase,
        "priority": priority,
        "responsible_role": responsible_role,
        "status": status,
        "dependencies": dependencies or [],
        "estimated_effort": effort,
        "start_date": None,
        "target_date": (now + timedelta(days=target_offset_days)).date().isoformat(),
        "completion_percentage": completion_percentage,
        "affected_frontend_files": frontend_files,
        "affected_backend_files": backend_files,
        "affected_api_routes": api_routes,
        "test_requirements": test_requirements,
        "acceptance_criteria": acceptance_criteria,
        "security_impact": security_impact,
        "financial_impact": financial_impact,
        "release_risk": release_risk,
        "notes": notes,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }


def _phase_task_defs() -> list[dict[str, Any]]:
    tasks: list[dict[str, Any]] = []

    tasks.extend([
        _task("P1-WALLET-001", "Wallet consistency", "Eine kanonische EUR-Balance-Quelle erzwingen, Legacy-Reads entfernen und Reconciliation-Bericht bereitstellen.", PHASES[0]["title"], "P0 Critical", "Backend Lead", "In Progress", "XL", 10, ["frontend/src/services/api.js", "frontend/src/pages/WalletPage.jsx", "frontend/src/store/WalletContext.jsx"], ["backend/routes/wallet.py", "backend/routes/admin_wallet.py", "backend/routes/super_app_features.py", "backend/core/payment_engine.py"], ["/api/wallet", "/api/wallet/balance", "/api/admin/wallet/reconciliation", "/api/super-app/wallet/balance"], ["Concurrent wallet tests", "Duplicate request tests", "Reconciliation regression"], ["Alle Wallet-Ansichten zeigen dieselbe EUR-Balance", "Keine historischen Transaktionen überschrieben", "Keine Balance-Resets"], "Critical", "Critical", "Critical", completion_percentage=55, notes="Doppeltes /api/wallet/balance und Legacy-Lesepfade sind noch echte P0-Themen."),
        _task("P1-ENV-001", "Environment separation", "Development, test, staging und production klar trennen; Produktion darf keine Test-/Demo-/Mock-Flags oder deaktivierte Finanzprüfungen nutzen.", PHASES[0]["title"], "P0 Critical", "Platform Ops", "Blocked", "L", 10, ["frontend/.env", "frontend/.env.production", "frontend/src/config/testMode.js", "frontend/src/config/release.js"], ["backend/.env", "backend/core/config.py", "backend/server.py"], [], ["Environment audit", "Production preflight check"], ["Production nutzt kein TEST_MODE oder DEMO_MODE", "Keine hard-coded Testuser in Production-Pfaden"], "Critical", "High", "Critical", completion_percentage=20, notes="KYC-Testbypass ist absichtlich aktiv und muss für Staging/Test klar von echter Production getrennt werden."),
        _task("P1-PARITY-001", "Web, iOS and Android version parity", "Gleiche freigegebene Frontend-Version auf Web, iOS und Android sichern; Build-ID sichtbar machen und stale Capacitor-Bundles ausweisen.", PHASES[0]["title"], "P0 Critical", "Mobile Lead", "In Review", "L", 10, ["frontend/public/version.json", "frontend/scripts/ios-prepare.js", "frontend/scripts/ios-sync-web-assets.js", "frontend/src/pages/AdminDiagPage.jsx"], ["backend/build_info.json"], [], ["Build parity check", "Mobile bundle audit"], ["Build-ID in Admin-Diagnose sichtbar", "Asset-Quelle lokal/remote ausgewiesen", "Stale Bundles identifiziert"], "Medium", "Medium", "Critical", completion_percentage=40),
        _task("P1-CI-001", "GitHub Actions hardening", "Frontend build, backend tests, ESLint, Playwright, visual QA, security checks und production preflight müssen als Gates gepflegt werden.", PHASES[0]["title"], "P0 Critical", "Platform Ops", "Blocked", "L", 10, [".github/workflows/ci.yml", ".github/workflows/deploy.yml", ".github/workflows/visual-qa.yml"], [], [], ["Workflow health review"], ["Kein Release bei offenem P0-Gate", "Alle Pflicht-Workflows im Dashboard sichtbar"], "High", "High", "Critical", completion_percentage=15),
    ])

    core_flows = [
        ("REG", "Registration", ["frontend/src/pages/AuthPage.jsx"], ["backend/routes/auth.py"], ["/api/auth/register"]),
        ("LOGIN", "Login", ["frontend/src/pages/AuthPage.jsx"], ["backend/routes/auth.py"], ["/api/auth/login"]),
        ("LOGOUT", "Logout", ["frontend/src/pages/MorePage.jsx"], ["backend/routes/auth.py"], ["/api/auth/logout"]),
        ("SESSION", "Session restore", ["frontend/src/services/api.js"], ["backend/routes/auth.py", "backend/routes/sessions.py"], ["/api/auth/me", "/api/auth/refresh"]),
        ("RESET", "Password reset", ["frontend/src/pages/ResetPasswordPage.jsx"], ["backend/routes/auth.py"], ["/api/auth/forgot-password", "/api/auth/reset-password"]),
        ("PROFILE", "Profile", ["frontend/src/pages/ProfilePage.jsx"], ["backend/routes/profile.py"], ["/api/profile/*"]),
        ("LANG", "Language selection", ["frontend/src/store/I18nContext.jsx", "frontend/src/pages/MorePage.jsx"], [], [],),
        ("WALLET", "Wallet", ["frontend/src/pages/WalletPage.jsx", "frontend/src/store/WalletContext.jsx"], ["backend/routes/wallet.py"], ["/api/wallet"]),
        ("SEND", "Send money", ["frontend/src/pages/SendMoneyPage.jsx", "frontend/src/components/SendMoneyModal.jsx"], ["backend/routes/payment.py", "backend/routes/wallet.py"], ["/api/payment/send", "/api/wallet/send"]),
        ("RECEIVE", "Receive money", ["frontend/src/pages/ReceiveMoneyPage.jsx"], ["backend/routes/p2p.py"], ["/api/p2p/qr/generate"]),
        ("QRSCAN", "QR scan", ["frontend/src/pages/ScannerPage.jsx", "frontend/src/pages/SendMoneyPage.jsx"], ["backend/routes/payment.py", "backend/routes/p2p.py"], ["/api/scan/resolve"]),
        ("QRRECV", "QR receive", ["frontend/src/pages/ReceiveMoneyPage.jsx"], ["backend/routes/p2p.py"], ["/api/p2p/qr/generate"]),
        ("TOPUP", "Top-up", ["frontend/src/pages/WalletPage.jsx"], ["backend/routes/wallet.py", "backend/routes/stripe.py"], ["/api/wallet/topup", "/api/stripe/*"]),
        ("HISTORY", "Transaction history", ["frontend/src/pages/WalletPage.jsx"], ["backend/routes/wallet.py", "backend/routes/transactions.py"], ["/api/wallet/transactions", "/api/transactions"]),
        ("NOTIF", "Notifications", ["frontend/src/pages/NotificationsPage.jsx"], ["backend/routes/notifications.py"], ["/api/notifications/*"]),
        ("SUPPORT", "Support", ["frontend/src/pages/SupportChatPage.jsx"], ["backend/routes/support.py", "backend/routes/support_tickets.py"], ["/api/support/*"]),
        ("DELETE", "Account deletion", ["frontend/src/pages/ProfilePage.jsx"], ["backend/routes/profile.py"], ["/api/profile/delete"]),
    ]
    for index, (suffix, title, frontend_files, backend_files, api_routes) in enumerate(core_flows, start=1):
        tasks.append(_task(
            f"P2-{suffix}-{index:03d}",
            title,
            f"{title} als Kernflow vollständig gegen Success, Validation, Network Error, Expired Session, Unauthorized, Empty State, Loading State und Mobile Layout prüfen.",
            PHASES[1]["title"],
            "P1 Required",
            "Frontend Lead" if suffix not in {"TOPUP", "SEND", "RECEIVE", "QRSCAN", "QRRECV", "NOTIF", "SUPPORT"} else "Backend Lead",
            "In Progress" if suffix in {"WALLET", "SEND", "RECEIVE", "SESSION"} else "Ready",
            "M",
            14,
            frontend_files,
            backend_files,
            api_routes,
            ["Success path", "Validation errors", "Network error", "Expired session", "Unauthorized access", "Empty state", "Loading state", "Mobile layout"],
            [f"{title} ist stabil und regressionssicher", "Kein UI-Crash bei fehlenden Daten"],
            "High" if suffix in {"WALLET", "SEND", "TOPUP", "SESSION", "RESET"} else "Medium",
            "Critical" if suffix in {"WALLET", "SEND", "TOPUP", "HISTORY"} else "Medium",
            "High",
            completion_percentage=45 if suffix in {"WALLET", "SEND", "RECEIVE", "SESSION"} else 25,
        ))

    merchant_admin_tasks = [
        ("M-ONBOARD", "Merchant onboarding", ["frontend/src/pages/MerchantOnboardingPage.jsx"], ["backend/routes/merchant.py"], ["/api/merchant/*"], "Merchant Ops"),
        ("M-APPROVAL", "Merchant approval status", ["frontend/src/pages/MerchantDashboardPage.jsx"], ["backend/routes/merchant.py"], ["/api/merchant/status"], "Merchant Ops"),
        ("M-DASH", "Merchant dashboard", ["frontend/src/pages/MerchantDashboardPage.jsx", "frontend/src/pages/MerchantPortalPage.jsx"], ["backend/routes/merchant.py", "backend/routes/merchant_portal.py"], ["/api/merchant/dashboard", "/api/merchant-portal/*"], "Merchant Ops"),
        ("M-QR", "Merchant QR payment", ["frontend/src/pages/MerchantTerminalPage.jsx"], ["backend/routes/payment.py"], ["/api/payment/merchant-scan"], "Merchant Ops"),
        ("M-TX", "Merchant transaction list", ["frontend/src/pages/MerchantDashboardPage.jsx"], ["backend/routes/merchant_payments.py"], ["/api/merchant/payments/*"], "Merchant Ops"),
        ("M-STAFF", "Merchant staff", ["frontend/src/pages/StaffManagementPage.jsx"], ["backend/routes/staff.py", "backend/routes/staff_manager.py"], ["/api/staff/*"], "Merchant Ops"),
        ("M-BRANCH", "Merchant branch selection", ["frontend/src/pages/MerchantDashboardPage.jsx"], ["backend/routes/merchant_hierarchy.py"], ["/api/merchant-hierarchy/*"], "Merchant Ops"),
        ("M-PAYOUT", "Merchant payout status", ["frontend/src/pages/MerchantDashboardPage.jsx"], ["backend/routes/payout.py"], ["/api/payout/*"], "Merchant Ops"),
        ("A-CUSTOMERS", "Admin customers", ["frontend/src/pages/AdminManagementPage.jsx"], ["backend/routes/admin_management.py"], ["/api/admin-management/*"], "Operations Lead"),
        ("A-MERCHANTS", "Admin merchants", ["frontend/src/pages/MerchantAdminPage.jsx"], ["backend/routes/merchant_admin.py"], ["/api/admin/merchants/*"], "Operations Lead"),
        ("A-TX", "Admin transactions", ["frontend/src/pages/AdminManagementPage.jsx", "frontend/src/pages/AdminWalletPage.jsx"], ["backend/routes/admin_wallet.py", "backend/routes/transactions.py"], ["/api/admin/wallet/*", "/api/transactions"], "Operations Lead"),
        ("A-WALLET", "Admin wallet view", ["frontend/src/pages/AdminWalletPage.jsx"], ["backend/routes/admin_wallet.py"], ["/api/admin/wallet/reconciliation"], "Operations Lead"),
        ("A-APPROVALS", "Admin approvals", ["frontend/src/pages/AdminPage.jsx"], ["backend/routes/admin_approvals.py"], ["/api/admin-approvals/*"], "Operations Lead"),
        ("A-FLAGS", "Admin feature flags", ["frontend/src/pages/AdminPage.jsx"], ["backend/routes/feature_flags.py"], ["/api/feature-flags/*"], "Operations Lead"),
        ("A-MONITOR", "Admin monitoring", ["frontend/src/pages/MonitoringDashboard.jsx"], ["backend/routes/monitoring.py"], ["/api/admin/monitoring/*"], "Operations Lead"),
        ("A-LOGS", "Admin logs", ["frontend/src/pages/AdminDiagPage.jsx"], ["backend/routes/diag.py"], ["/api/diag/*"], "Operations Lead"),
        ("A-HEALTH", "Admin system health", ["frontend/src/pages/AdminDiagPage.jsx"], ["backend/server.py", "backend/routes/diag.py"], ["/health", "/api/diag/health-deep"], "Operations Lead"),
        ("A-VERSION", "Admin deployment version", ["frontend/src/pages/AdminDeploymentInfoPage.jsx", "frontend/src/pages/AdminDiagPage.jsx"], ["backend/routes/system_version.py", "backend/build_info.json"], ["/api/system/version"], "Operations Lead"),
    ]
    for index, (suffix, title, frontend_files, backend_files, api_routes, role) in enumerate(merchant_admin_tasks, start=1):
        tasks.append(_task(
            f"P3-{suffix}-{index:03d}",
            title,
            f"{title} ohne Crash bei fehlenden Werten absichern und für Beta verifizieren.",
            PHASES[2]["title"],
            "P1 Required",
            role,
            "In Progress" if suffix in {"A-WALLET", "A-MONITOR", "A-VERSION", "M-DASH"} else "Ready",
            "M",
            18,
            frontend_files,
            backend_files,
            api_routes,
            ["Success path", "Missing values", "Unauthorized access", "Empty state", "Mobile layout"],
            [f"{title} rendert stabil", "Keine Admin-/Merchant-Crashes bei null/undefined Feldern"],
            "High" if suffix.startswith("A-") else "Medium",
            "High" if suffix in {"A-TX", "A-WALLET", "M-PAYOUT"} else "Medium",
            "High",
            completion_percentage=50 if suffix in {"A-WALLET", "A-MONITOR", "A-VERSION"} else 30,
        ))

    mobile_tasks = [
        ("VIEWPORTS", "Viewport sweep 320→1440", "Alle wichtigen Routen auf 320x568, 375x812, 390x844, 430x932, 768x1024 und 1440x900 prüfen."),
        ("OVERFLOW", "Horizontal overflow cleanup", "Horizontalen Overflow, verdeckte Buttons und abgeschnittene Inhalte entfernen."),
        ("SAFEAREA", "Safe-area and bottom navigation", "Safe-Area-Spacings und verdeckende Bottom-Navigation korrigieren."),
        ("MONEY", "MoneyAmount rollout", "MoneyAmount auf Kernrouten konsistent einsetzen."),
        ("COUNTDOWN", "CountdownTimer rollout", "CountdownTimer und Preis-/Timer-Darstellung angleichen."),
        ("PAGESHELL", "PageShell and Cards rollout", "PageShell, Buttons, Cards, EmptyState, ErrorState und LoadingState auf Kernrouten nutzen."),
        ("IMAGES", "Image correctness and quality", "Gebrochene Bilder, falsche Produktbilder und Cropping-Probleme beheben."),
        ("LANGMIX", "Language and formatting cleanup", "Gemischte Sprachen, fehlerhafte Preise und malformed timer beseitigen."),
    ]
    for index, (suffix, title, description) in enumerate(mobile_tasks, start=1):
        tasks.append(_task(
            f"P4-{suffix}-{index:03d}",
            title,
            description,
            PHASES[3]["title"],
            "P1 Required",
            "Design Lead" if suffix in {"MONEY", "COUNTDOWN", "PAGESHELL"} else "Frontend Lead",
            "In Progress" if suffix in {"VIEWPORTS", "OVERFLOW", "SAFEAREA", "MONEY", "COUNTDOWN", "PAGESHELL"} else "Ready",
            "M",
            18,
            ["frontend/src/pages/WalletPage.jsx", "frontend/src/pages/TaxiPage.jsx", "frontend/src/pages/AuctionsPage.jsx", "frontend/src/design/tokens.css"],
            [],
            [],
            ["Viewport regression", "Visual QA report", "Smoke on core routes"],
            [f"{title} ist auf Kernrouten sichtbar verifiziert"],
            "Low",
            "Medium",
            "High",
            completion_percentage=60 if suffix in {"MONEY", "COUNTDOWN", "PAGESHELL"} else 45,
        ))

    translation_tasks = [
        ("ACTIVE", "Audit active user-facing pages", "Alle aktiven Nutzerseiten in allen unterstützten Sprachen auditieren."),
        ("KEYS", "Missing translation keys", "Fehlende Translation Keys und harte Strings identifizieren."),
        ("DE", "German page purity", "Englische Texte in deutschen Seiten und Buttons entfernen."),
        ("VALIDATION", "Validation and empty state translation", "Validierungs-, Empty-State- und ErrorState-Texte vollständig übersetzen."),
        ("REPORT", "Missing translation report", "Fehlende Übersetzungen als Report ausgeben und offen halten bis bereinigt."),
    ]
    for index, (suffix, title, description) in enumerate(translation_tasks, start=1):
        tasks.append(_task(
            f"P5-{suffix}-{index:03d}",
            title,
            description,
            PHASES[4]["title"],
            "P1 Required",
            "QA Lead",
            "In Progress" if suffix in {"ACTIVE", "KEYS", "DE"} else "Ready",
            "S",
            14,
            ["frontend/src/store/I18nContext.jsx"],
            [],
            [],
            ["Translation audit", "Manual language spot check"],
            [f"{title} transparent dokumentiert und ohne sichtbare Restfehler"],
            "Low",
            "Low",
            "Medium",
            completion_percentage=35 if suffix == "ACTIVE" else 20,
        ))

    store_tasks = [
        ("CONFIG", "Store-safe mobile configuration", "Store-safe Modus für iOS/Android sauber definieren und anwenden."),
        ("HIDE", "Hide or disable non-approved modules", "Auktionen, Gaming, Mining, Crypto, Lending/BNPL und ähnliche Bereiche in Store-Builds sperren."),
        ("CORE", "Core-app store surface", "Store-Build auf Account, Wallet, QR, Merchant, History, Support, Notifications, Profile und Legal fokussieren."),
        ("META", "Store metadata readiness", "Privacy, Terms, Support, Account Deletion, Permission Descriptions, Icons, Splash, Reviewer-Account und Screenshots prüfen."),
        ("LEGAL", "Legal and reviewer readiness", "Reviewer-Anweisungen und rechtlich freigegebene Store-Oberfläche final prüfen."),
    ]
    for index, (suffix, title, description) in enumerate(store_tasks, start=1):
        tasks.append(_task(
            f"P6-{suffix}-{index:03d}",
            title,
            description,
            PHASES[5]["title"],
            "P1 Required",
            "Mobile Lead",
            "In Progress" if suffix in {"CONFIG", "HIDE"} else "Ready",
            "M",
            14,
            ["frontend/src/config/release.js", "frontend/src/App.js", "frontend/public/store-assets/*"],
            [],
            [],
            ["Store-safe smoke", "Static route audit"],
            [f"{title} ist dokumentiert und in Mobile-Builds erkennbar"],
            "High",
            "High",
            "High",
            completion_percentage=50 if suffix in {"CONFIG", "HIDE"} else 15,
        ))

    artifact_tasks = [
        ("WEB", "Web release artifacts", "Production build, Deployment-Verifikation und Rollback-Paket vorbereiten."),
        ("IOS", "iOS release artifacts", "Xcode Workspace, Signing-Checklist, Archive-Checklist, TestFlight Notes und Reviewer Instructions vorbereiten."),
        ("ANDROID", "Android release artifacts", "Signed AAB Checklist, Internal Testing Notes und Reviewer Instructions vorbereiten."),
        ("HONESTY", "Artifact truthfulness", "Nie behaupten, dass IPA/AAB existiert, wenn nicht wirklich gebaut."),
    ]
    for index, (suffix, title, description) in enumerate(artifact_tasks, start=1):
        tasks.append(_task(
            f"P7-{suffix}-{index:03d}",
            title,
            description,
            PHASES[6]["title"],
            "P1 Required",
            "Platform Ops",
            "Ready" if suffix == "HONESTY" else "Backlog",
            "M",
            18,
            ["frontend/build-mobile-final.sh", "frontend/build-aab-release.sh"],
            [],
            [],
            ["Artifact checklist review"],
            [f"{title} ist real belegbar oder klar als offen markiert"],
            "Medium",
            "Medium",
            "High",
            completion_percentage=100 if suffix == "HONESTY" else 0,
        ))

    tasks.extend([
        _task("P8-REPORT-001", "Final acceptance table", "Finale Tabelle mit Feature-, Web-, iOS-, Android-, Backend-, Test-, Blocker- und Beta-Status erzeugen.", PHASES[7]["title"], "P1 Required", "Operations Lead", "In Progress", "S", 7, ["frontend/src/pages/AdminMasterRoadmapPage.jsx"], ["backend/routes/master_roadmap.py"], ["/api/master-roadmap/final-acceptance"], ["Acceptance endpoint check"], ["Finale Tabelle enthält ehrliche Readiness-Daten"], "Low", "Low", "High", completion_percentage=60),
        _task("P8-BLOCKERS-002", "Remaining P0/P1 issue register", "Exakte verbleibende P0- und P1-Themen mit Build IDs, Workflows, Commit Hash und Beta-Readiness ausgeben.", PHASES[7]["title"], "P1 Required", "Operations Lead", "In Progress", "S", 7, ["frontend/src/pages/AdminMasterRoadmapPage.jsx"], ["backend/routes/master_roadmap.py", "backend/build_info.json"], ["/api/master-roadmap/final-acceptance"], ["Acceptance endpoint check"], ["Offene P0/P1-Issues sind vollständig und nicht geschönt"], "Low", "Low", "Critical", completion_percentage=60),
    ])
    return tasks


def _feature_registry_seed() -> list[dict[str, Any]]:
    def item(
        key: str,
        name: str,
        phase: str,
        enabled_dev: bool,
        enabled_test: bool,
        enabled_staging: bool,
        enabled_web: bool,
        enabled_ios: bool,
        enabled_android: bool,
        store_safe: bool,
        requires_kyc: bool,
        requires_payment_license: bool,
        requires_manual_approval: bool,
        notes: str = "",
    ) -> dict[str, Any]:
        return {
            "module_key": key,
            "name": name,
            "phase": phase,
            "enabled_in_development": enabled_dev,
            "enabled_in_test": enabled_test,
            "enabled_in_staging": enabled_staging,
            "enabled_in_web_production": enabled_web,
            "enabled_in_ios": enabled_ios,
            "enabled_in_android": enabled_android,
            "store_safe": store_safe,
            "requires_kyc": requires_kyc,
            "requires_payment_license": requires_payment_license,
            "requires_manual_approval": requires_manual_approval,
            "notes": notes,
            "updated_at": _now_iso(),
        }

    return [
        item("account", "Account", PHASES[1]["title"], True, True, True, True, True, True, True, False, False, False),
        item("auth", "Registration / Login", PHASES[1]["title"], True, True, True, True, True, True, True, False, False, False),
        item("wallet", "Wallet", PHASES[1]["title"], True, True, True, False, False, False, False, True, True, True, "Bis Wallet-P0 geschlossen ist kein Produktions-Release."),
        item("qr", "QR", PHASES[1]["title"], True, True, True, True, True, True, True, False, True, True),
        item("merchant", "Merchant", PHASES[2]["title"], True, True, True, True, True, True, True, True, True, True),
        item("transaction_history", "Transaction History", PHASES[1]["title"], True, True, True, True, True, True, True, False, False, False),
        item("support", "Support", PHASES[1]["title"], True, True, True, True, True, True, True, False, False, False),
        item("notifications", "Notifications", PHASES[1]["title"], True, True, True, True, True, True, True, False, False, False),
        item("profile", "Profile", PHASES[1]["title"], True, True, True, True, True, True, True, False, False, False),
        item("legal", "Legal Pages", PHASES[5]["title"], True, True, True, True, True, True, True, False, False, False),
        item("auctions", "Auctions", PHASES[5]["title"], True, True, False, False, False, False, False, False, False, True, "Store-safe Build muss Auktionen sperren."),
        item("live_auctions", "Live Auctions", PHASES[5]["title"], True, False, False, False, False, False, False, False, False, True),
        item("gaming", "Gaming", PHASES[5]["title"], True, False, False, False, False, False, False, False, False, True),
        item("lottery", "Lottery", PHASES[5]["title"], True, False, False, False, False, False, False, False, False, True),
        item("mining", "Mining investment", PHASES[5]["title"], True, False, False, False, False, False, False, False, False, True),
        item("crypto", "Crypto investment", PHASES[5]["title"], True, False, False, False, False, False, False, True, True, True),
        item("bnpl", "BNPL / Lending", PHASES[5]["title"], True, False, False, False, False, False, False, True, True, True),
        item("instant_credit", "Instant Credit / Lending", PHASES[5]["title"], True, False, False, False, False, False, False, True, True, True),
    ]


def _version_snapshot() -> dict[str, Any]:
    build_info = _build_info()
    frontend_version = _safe_json(FRONTEND_DIR / "public" / "version.json")
    ios_root_version = _safe_json(IOS_ROOT_PUBLIC_DIR / "version.json")
    ios_frontend_version = _safe_json(IOS_FRONTEND_PUBLIC_DIR / "version.json")
    web_build_exists = (FRONTEND_BUILD_DIR / "index.html").exists()
    ios_root_exists = IOS_ROOT_PUBLIC_DIR.exists()
    ios_frontend_exists = IOS_FRONTEND_PUBLIC_DIR.exists()
    same_ios_bundle = (ios_root_version or {}).get("build_id") == (ios_frontend_version or {}).get("build_id") if ios_root_version and ios_frontend_version else False
    return {
        "build_info": build_info,
        "web_version_file": frontend_version,
        "ios_root_version_file": ios_root_version,
        "ios_frontend_version_file": ios_frontend_version,
        "web_build_exists": web_build_exists,
        "ios_root_bundle_exists": ios_root_exists,
        "ios_frontend_bundle_exists": ios_frontend_exists,
        "ios_bundle_parity": same_ios_bundle,
        "asset_delivery": "local_bundle" if ios_root_exists else "unknown",
    }


def _environment_snapshot() -> dict[str, Any]:
    frontend_env = _read_env_file(FRONTEND_DIR / ".env")
    frontend_prod_env = _read_env_file(FRONTEND_DIR / ".env.production")
    backend_env = _read_env_file(BASE_DIR / "backend" / ".env")
    return {
        "frontend_env": {
            "REACT_APP_DISABLE_KYC": frontend_env.get("REACT_APP_DISABLE_KYC"),
            "REACT_APP_TEST_MODE": frontend_env.get("REACT_APP_TEST_MODE"),
            "REACT_APP_TEST_MODE_FULL_ACCESS": frontend_env.get("REACT_APP_TEST_MODE_FULL_ACCESS"),
            "REACT_APP_DEMO_MODE": frontend_env.get("REACT_APP_DEMO_MODE"),
            "REACT_APP_MOCK_PAYMENTS": frontend_env.get("REACT_APP_MOCK_PAYMENTS"),
            "REACT_APP_STORE_SAFE_MODE": frontend_env.get("REACT_APP_STORE_SAFE_MODE"),
        },
        "frontend_production_env": {
            "REACT_APP_DISABLE_KYC": frontend_prod_env.get("REACT_APP_DISABLE_KYC"),
            "REACT_APP_DEMO_MODE": frontend_prod_env.get("REACT_APP_DEMO_MODE"),
            "REACT_APP_MOCK_PAYMENTS": frontend_prod_env.get("REACT_APP_MOCK_PAYMENTS"),
            "REACT_APP_STORE_SAFE_MODE": frontend_prod_env.get("REACT_APP_STORE_SAFE_MODE"),
        },
        "backend_env": {
            "TEST_MODE": backend_env.get("TEST_MODE"),
            "DEMO_MODE": backend_env.get("DEMO_MODE"),
            "DB_NAME": backend_env.get("DB_NAME"),
        },
    }


def _workflow_snapshot(latest_qa: dict[str, Any]) -> list[dict[str, Any]]:
    qa_ok = latest_qa.get("critical_issues", 1) == 0 and latest_qa.get("failed", 1) == 0 and latest_qa.get("pages_scanned", 0) > 0
    eslint_file = FRONTEND_DIR / "package.json"
    return [
        {"key": "frontend_build", "label": "frontend build", "status": "verified" if (FRONTEND_BUILD_DIR / "index.html").exists() else "blocked", "notes": "Lokaler Build-Output vorhanden."},
        {"key": "backend_tests", "label": "backend tests", "status": "blocked", "notes": "Globale Pytest-Suite ist historisch instabil und nicht als grün belegbar."},
        {"key": "eslint", "label": "ESLint", "status": "incomplete" if eslint_file.exists() else "blocked", "notes": "Projekt enthält bekannte Alt-Warnungen; finaler grüner Pflichtlauf fehlt."},
        {"key": "playwright", "label": "Playwright", "status": "verified" if qa_ok else "blocked", "notes": "Leitet sich aus dem letzten Visual-QA-/Browser-Lauf ab."},
        {"key": "visual_qa", "label": "visual QA", "status": "verified" if qa_ok else "blocked", "notes": "Letzter Lauf muss fehlerfrei und ohne kritische Issues sein."},
        {"key": "security_checks", "label": "security checks", "status": "blocked", "notes": "Geheimer/Produktions-Sicherheitsaudit noch offen."},
        {"key": "production_preflight", "label": "production preflight", "status": "blocked", "notes": "P0-Blocker verhindern aktuell jeden Production-Preflight."},
    ]


def _wallet_diagnostics() -> dict[str, Any]:
    wallet_source = (BASE_DIR / "backend" / "routes" / "wallet.py").read_text(encoding="utf-8")
    super_app_source = (BASE_DIR / "backend" / "routes" / "super_app_features.py").read_text(encoding="utf-8")
    duplicate_balance_endpoints = wallet_source.count('@router.get("/balance")')
    has_legacy_super_app_balance = '"/wallet/balance"' in super_app_source
    return {
        "canonical_visible_source": "users.balance",
        "duplicate_balance_endpoints": duplicate_balance_endpoints,
        "has_legacy_super_app_balance": has_legacy_super_app_balance,
        "approved_engine_required": True,
        "reconciliation_endpoint": "/api/admin/wallet/reconciliation",
        "status": "blocked" if duplicate_balance_endpoints > 1 or has_legacy_super_app_balance else "verified",
    }


def _release_gate_seed(tasks: list[dict[str, Any]], latest_qa: dict[str, Any]) -> list[dict[str, Any]]:
    version_snapshot = _version_snapshot()
    env_snapshot = _environment_snapshot()
    workflows = _workflow_snapshot(latest_qa)
    wallet = _wallet_diagnostics()

    frontend_build_ok = version_snapshot["web_build_exists"]
    production_disable_kyc = (env_snapshot["frontend_production_env"].get("REACT_APP_DISABLE_KYC") or "").lower() in {"1", "true", "yes", "on"}
    production_demo_mode = (env_snapshot["frontend_production_env"].get("REACT_APP_DEMO_MODE") or "").lower() in {"1", "true", "yes", "on"}
    production_mock_payments = (env_snapshot["frontend_production_env"].get("REACT_APP_MOCK_PAYMENTS") or "").lower() in {"1", "true", "yes", "on"}
    ios_parity_ok = bool(version_snapshot["ios_bundle_parity"])
    qa_ok = latest_qa.get("critical_issues", 1) == 0 and latest_qa.get("failed", 1) == 0 and latest_qa.get("pages_scanned", 0) > 0

    workflow_map = {item["key"]: item for item in workflows}
    gates = [
        {"gate_key": "wallet_consistency", "label": "Wallet consistency", "status": wallet["status"], "recorded_value": f"duplicate_balance_endpoints={wallet['duplicate_balance_endpoints']}", "notes": "Eine kanonische EUR-Quelle ist Pflicht vor Beta."},
        {"gate_key": "environment_separation", "label": "Environment separation", "status": "blocked" if (production_disable_kyc or production_demo_mode or production_mock_payments) else "incomplete", "recorded_value": f"disable_kyc={production_disable_kyc},demo={production_demo_mode},mock={production_mock_payments}", "notes": "Production darf keine Test-/Demo-/Mock-Konfiguration tragen."},
        {"gate_key": "version_parity", "label": "Web / iOS / Android parity", "status": "incomplete" if frontend_build_ok else "blocked", "recorded_value": f"web_build={frontend_build_ok},ios_bundle_parity={ios_parity_ok}", "notes": "Alle Plattformen müssen denselben freigegebenen Frontend-Commit verwenden."},
        {"gate_key": "frontend_build", "label": "Frontend build", "status": "verified" if frontend_build_ok else "blocked", "recorded_value": str(frontend_build_ok).lower(), "notes": workflow_map["frontend_build"]["notes"]},
        {"gate_key": "backend_tests", "label": "Backend tests", "status": workflow_map["backend_tests"]["status"], "recorded_value": "global-suite-unstable", "notes": workflow_map["backend_tests"]["notes"]},
        {"gate_key": "eslint", "label": "ESLint", "status": workflow_map["eslint"]["status"], "recorded_value": "pending-clean-run", "notes": workflow_map["eslint"]["notes"]},
        {"gate_key": "playwright", "label": "Playwright", "status": workflow_map["playwright"]["status"], "recorded_value": latest_qa.get("status", "unknown"), "notes": workflow_map["playwright"]["notes"]},
        {"gate_key": "visual_qa", "label": "Visual QA", "status": workflow_map["visual_qa"]["status"], "recorded_value": str(latest_qa.get("critical_issues", 0)), "notes": workflow_map["visual_qa"]["notes"]},
        {"gate_key": "security_checks", "label": "Security checks", "status": workflow_map["security_checks"]["status"], "recorded_value": "pending", "notes": workflow_map["security_checks"]["notes"]},
        {"gate_key": "production_preflight", "label": "Production preflight", "status": workflow_map["production_preflight"]["status"], "recorded_value": "blocked-by-open-p0", "notes": workflow_map["production_preflight"]["notes"]},
        {"gate_key": "store_safe_release", "label": "Store-safe release", "status": "incomplete", "recorded_value": env_snapshot["frontend_production_env"].get("REACT_APP_STORE_SAFE_MODE") or "unknown", "notes": "Store-safe Mobile-Konfiguration und Reviewer-Oberfläche müssen separat freigegeben werden."},
        {"gate_key": "final_acceptance_report", "label": "Final acceptance report", "status": "incomplete", "recorded_value": "draft", "notes": "Die finale Tabelle darf erst bei geschlossenen P0 sauber grün werden."},
    ]
    return [{**gate, "updated_at": _now_iso()} for gate in gates]


def _readiness_color(statuses: list[str]) -> str:
    lowered = {status.lower() for status in statuses}
    if lowered == {"completed"}:
        return "green"
    if lowered & {"blocked", "backlog", "ready"}:
        return "red"
    return "yellow"


def _phase_summary(tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for phase in PHASES:
        phase_tasks = [task for task in tasks if task["phase"] == phase["title"]]
        completed = sum(1 for task in phase_tasks if task["status"] == "Completed")
        avg_progress = round(sum(task.get("completion_percentage", 0) for task in phase_tasks) / max(1, len(phase_tasks)))
        result.append({**phase, "task_count": len(phase_tasks), "completed": completed, "average_completion": avg_progress})
    return result


def _launch_readiness(tasks: list[dict[str, Any]], release_gates: list[dict[str, Any]]) -> dict[str, Any]:
    p0_open = [task for task in tasks if task["priority"] == "P0 Critical" and task["status"] != "Completed"]
    blocked_gates = [gate for gate in release_gates if gate["status"] != "verified"]
    sections = {
        "wallet_consistency": ["P1-WALLET-001"],
        "environment_separation": ["P1-ENV-001"],
        "version_parity": ["P1-PARITY-001"],
        "github_actions": ["P1-CI-001"],
        "core_user_flows": [task["task_id"] for task in tasks if task["phase"] == PHASES[1]["title"]],
        "merchant_admin": [task["task_id"] for task in tasks if task["phase"] == PHASES[2]["title"]],
        "mobile_quality": [task["task_id"] for task in tasks if task["phase"] == PHASES[3]["title"]],
        "translation_audit": [task["task_id"] for task in tasks if task["phase"] == PHASES[4]["title"]],
        "store_safe": [task["task_id"] for task in tasks if task["phase"] == PHASES[5]["title"]],
    }
    task_map = {task["task_id"]: task for task in tasks}
    items = []
    for key, ids in sections.items():
        statuses = [task_map[task_id]["status"] for task_id in ids if task_id in task_map]
        items.append({
            "key": key,
            "label": key.replace("_", " ").title(),
            "color": _readiness_color(statuses),
            "task_ids": ids,
            "statuses": statuses,
        })
    return {
        "items": items,
        "launch_ready": len(p0_open) == 0 and not blocked_gates,
        "open_p0_tasks": len(p0_open),
        "blocked_gates": len(blocked_gates),
        "message": "Launch Ready bleibt false, solange P0 offen oder Gates nicht verifiziert sind.",
    }


def _ceo_view(tasks: list[dict[str, Any]], release_gates: list[dict[str, Any]], latest_qa: dict[str, Any]) -> dict[str, Any]:
    build_info = _build_info()
    now = datetime.now(timezone.utc)
    this_week = (now - timedelta(days=7)).isoformat()[:10]
    completed_this_week = [task for task in tasks if task["status"] == "Completed" and (task.get("updated_at") or "")[:10] >= this_week]
    delayed = [task for task in tasks if task.get("target_date") and task["status"] != "Completed" and task["target_date"] < now.date().isoformat()]
    p0_blockers = [task for task in tasks if task["priority"] == "P0 Critical" and task["status"] != "Completed"]
    security_risks = [task for task in tasks if task["security_impact"] in {"High", "Critical"} and task["status"] != "Completed"][:10]
    financial_risks = [task for task in tasks if task["financial_impact"] in {"High", "Critical"} and task["status"] != "Completed"][:10]
    next_five = sorted(
        [task for task in tasks if task["status"] != "Completed"],
        key=lambda task: (PRIORITY_ORDER.index(task["priority"]), STATUS_ORDER.index(task["status"]), task["task_id"]),
    )[:5]
    return {
        "p0_blockers": p0_blockers,
        "tasks_completed_this_week": completed_this_week,
        "tasks_delayed": delayed,
        "current_web_build_id": build_info.get("build_id") or "unknown",
        "current_web_commit": build_info.get("git_commit") or "unknown",
        "current_staging_url": build_info.get("public_base_url") or build_info.get("api_base_url") or "unknown",
        "open_security_risks": security_risks,
        "open_financial_risks": financial_risks,
        "next_five_priorities": next_five,
        "latest_visual_qa": latest_qa,
        "release_gates": release_gates,
    }


async def _investor_view_payload(tasks: list[dict[str, Any]], feature_registry: list[dict[str, Any]]) -> dict[str, Any]:
    updates = await db.investor_updates.find(
        {"is_active": True},
        {"_id": 0, "title": 1, "summary": 1, "published_at": 1},
    ).sort("published_at", -1).limit(6).to_list(6)
    build_info = _build_info()
    completed = [task for task in tasks if task["status"] == "Completed"][:8]
    current_phase = next((phase for phase in _phase_summary(tasks) if phase["average_completion"] < 100), PHASES[-1])
    next_milestones = [task for task in tasks if task["status"] in {"Ready", "In Progress", "Testing", "In Review", "Manual Approval"}][:8]
    sanitized_registry = [
        {
            "module_key": item["module_key"],
            "name": item["name"],
            "enabled_in_development": item["enabled_in_development"],
            "enabled_in_test": item["enabled_in_test"],
            "enabled_in_staging": item.get("enabled_in_staging", False),
            "enabled_in_web_production": item["enabled_in_web_production"],
        }
        for item in feature_registry
        if item["module_key"] not in {"wallet", "qr", "merchant", "support", "notifications", "profile", "auth", "account", "legal", "transaction_history"}
        or True
    ]
    return {
        "completed_milestones": [{"task_id": task["task_id"], "title": task["title"], "phase": task["phase"]} for task in completed],
        "current_development_phase": {
            "title": current_phase["title"],
            "priority": current_phase["priority"],
            "average_completion": current_phase.get("average_completion", 0),
        },
        "next_planned_milestones": [{"task_id": task["task_id"], "title": task["title"], "phase": task["phase"], "target_date": task.get("target_date")} for task in next_milestones],
        "released_app_versions": {
            "web": build_info.get("build_id") or "unknown",
            "ios": _version_snapshot()["ios_root_version_file"].get("buildId") or "unknown",
            "android": "unknown",
        },
        "product_status": sanitized_registry[:10],
        "financing_use_categories": ["Technology", "Security", "Compliance", "Operations", "Controlled beta"],
        "approved_company_updates": updates,
        "disclosure_policy": "Keine Kundendaten, Credentials, Sicherheitsdetails, Quellcode, privaten Finanzdaten oder offenen Schwachstellen in dieser Ansicht.",
    }


def _final_acceptance_report(tasks: list[dict[str, Any]], release_gates: list[dict[str, Any]], feature_registry: list[dict[str, Any]]) -> dict[str, Any]:
    build_info = _build_info()
    version_snapshot = _version_snapshot()
    readiness = _launch_readiness(tasks, release_gates)
    task_map = {task["task_id"]: task for task in tasks}

    def phase_ready(phase_title: str) -> bool:
        phase_tasks = [task for task in tasks if task["phase"] == phase_title]
        return bool(phase_tasks) and all(task["status"] == "Completed" for task in phase_tasks)

    rows = [
        {"feature": "Launch blockers", "web_status": "blocked" if any(task_map[k]["status"] != "Completed" for k in ["P1-WALLET-001", "P1-ENV-001", "P1-PARITY-001", "P1-CI-001"] if k in task_map) else "ready", "ios_status": "incomplete", "android_status": "blocked", "backend_status": "blocked", "tests": "partial", "blocker": "Open P0 tasks", "ready_for_beta": False},
        {"feature": "Core user flows", "web_status": "in-progress" if not phase_ready(PHASES[1]["title"]) else "ready", "ios_status": "incomplete", "android_status": "incomplete", "backend_status": "in-progress", "tests": "partial", "blocker": "Flow matrix unfinished", "ready_for_beta": False},
        {"feature": "Merchant and admin", "web_status": "in-progress" if not phase_ready(PHASES[2]["title"]) else "ready", "ios_status": "n/a", "android_status": "n/a", "backend_status": "in-progress", "tests": "partial", "blocker": "Crash hardening still open", "ready_for_beta": False},
        {"feature": "Mobile quality", "web_status": "in-progress", "ios_status": "in-progress", "android_status": "in-progress", "backend_status": "n/a", "tests": "partial", "blocker": "Viewport matrix unfinished", "ready_for_beta": False},
        {"feature": "Translation audit", "web_status": "in-progress", "ios_status": "in-progress", "android_status": "in-progress", "backend_status": "n/a", "tests": "partial", "blocker": "Visible untranslated text remains", "ready_for_beta": False},
        {"feature": "Store-safe release", "web_status": "incomplete", "ios_status": "in-progress", "android_status": "in-progress", "backend_status": "n/a", "tests": "partial", "blocker": "Store-safe gating not fully signed off", "ready_for_beta": False},
        {"feature": "Release artifacts", "web_status": "partial", "ios_status": "partial", "android_status": "blocked", "backend_status": "n/a", "tests": "n/a", "blocker": "Real IPA/AAB not evidenced", "ready_for_beta": False},
    ]

    p0_issues = [task for task in tasks if task["priority"] == "P0 Critical" and task["status"] != "Completed"]
    p1_issues = [task for task in tasks if task["priority"] == "P1 Required" and task["status"] != "Completed"]
    passed_workflows = [gate["label"] for gate in release_gates if gate["status"] == "verified"]
    build_ids = {
        "web": build_info.get("build_id") or "unknown",
        "frontend_commit": build_info.get("git_commit") or "unknown",
        "frontend_version_file": version_snapshot["web_version_file"].get("buildId") or version_snapshot["web_version_file"].get("build_id") or "unknown",
        "ios_root_bundle": version_snapshot["ios_root_version_file"].get("buildId") or version_snapshot["ios_root_version_file"].get("build_id") or "unknown",
        "ios_frontend_bundle": version_snapshot["ios_frontend_version_file"].get("buildId") or version_snapshot["ios_frontend_version_file"].get("build_id") or "unknown",
        "android": "unknown",
    }
    production_url = os.environ.get("PRODUCTION_URL") or "unknown"

    return {
        "rows": rows,
        "remaining_p0_issues": [{"task_id": task["task_id"], "title": task["title"], "status": task["status"]} for task in p0_issues],
        "remaining_p1_issues": [{"task_id": task["task_id"], "title": task["title"], "status": task["status"]} for task in p1_issues],
        "files_changed": sorted({path for task in tasks for path in (task.get("affected_frontend_files", []) + task.get("affected_backend_files", [])) if path})[:200],
        "workflows_passed": passed_workflows,
        "build_ids": build_ids,
        "commit_hash": build_info.get("git_commit") or "unknown",
        "staging_url": build_info.get("public_base_url") or build_info.get("api_base_url") or "unknown",
        "production_url": production_url,
        "testflight_readiness": "not_ready" if any(task["phase"] in {PHASES[0]["title"], PHASES[5]["title"], PHASES[6]["title"]} and task["status"] != "Completed" for task in tasks) else "ready",
        "google_play_readiness": "blocked" if any(task["task_id"] == "P1-PARITY-001" and task["status"] != "Completed" for task in tasks) else "ready",
        "ready_for_beta": readiness["launch_ready"],
        "registry_snapshot": [{"module_key": item["module_key"], "name": item["name"], "enabled_in_web_production": item["enabled_in_web_production"], "enabled_in_ios": item["enabled_in_ios"], "enabled_in_android": item["enabled_in_android"]} for item in feature_registry],
    }


async def _ensure_seed_data() -> None:
    await db.master_roadmap_tasks.create_index("task_id", unique=True)
    await db.master_roadmap_tasks.create_index("phase")
    await db.master_roadmap_feature_registry.create_index("module_key", unique=True)
    await db.master_roadmap_release_gates.create_index("gate_key", unique=True)
    await db.master_roadmap_meta.create_index("meta_key", unique=True)
    await db.master_roadmap_audit.create_index("created_at")

    version_doc = await db.master_roadmap_meta.find_one({"meta_key": "schema_version"}, {"_id": 0}) or {}
    if version_doc.get("value") != SCHEMA_VERSION:
        await db.master_roadmap_tasks.delete_many({"task_id": {"$not": {"$regex": r"^QA-"}}})
        await db.master_roadmap_feature_registry.delete_many({})
        await db.master_roadmap_release_gates.delete_many({})
        seed_tasks = _phase_task_defs()
        if seed_tasks:
            await db.master_roadmap_tasks.insert_many(seed_tasks)
        feature_registry = _feature_registry_seed()
        if feature_registry:
            await db.master_roadmap_feature_registry.insert_many(feature_registry)
        await db.master_roadmap_meta.update_one({"meta_key": "phases"}, {"$set": {"items": PHASES, "updated_at": _now_iso()}}, upsert=True)
        await db.master_roadmap_meta.update_one({"meta_key": "schema_version"}, {"$set": {"value": SCHEMA_VERSION, "updated_at": _now_iso()}}, upsert=True)
    elif await db.master_roadmap_meta.count_documents({"meta_key": "phases"}) == 0:
        await db.master_roadmap_meta.insert_one({"meta_key": "phases", "items": PHASES, "updated_at": _now_iso()})


async def _load_release_gates(tasks: list[dict[str, Any]], latest_qa: dict[str, Any]) -> list[dict[str, Any]]:
    existing = await db.master_roadmap_release_gates.find({}, {"_id": 0}).sort("gate_key", 1).to_list(200)
    if existing:
        return existing
    seeded = _release_gate_seed(tasks, latest_qa)
    if seeded:
        await db.master_roadmap_release_gates.insert_many(seeded)
    return seeded


def route_file_hint(route: str, category: str) -> str:
    if route.startswith("/taxi"):
        return "frontend/src/pages/TaxiPage.jsx"
    if route.startswith("/wallet"):
        return "frontend/src/pages/WalletPage.jsx"
    if route.startswith("/auction/"):
        return "frontend/src/components/auctions/AuctionDetail.jsx"
    if route.startswith("/auctions"):
        return "frontend/src/components/auctions/AuctionGridCard.jsx"
    if category == "translation":
        return "frontend/src/store/I18nContext.jsx"
    return "frontend/src/design/tokens.css"


async def sync_visual_qa_issues_to_master_roadmap(issues: list[dict[str, Any]], commit_hash: str = "", branch: str = "") -> None:
    await _ensure_seed_data()
    for issue in issues:
        severity = str(issue.get("severity", "medium")).lower()
        priority = "P0 Critical" if severity in {"critical", "high"} else "P1 Required"
        route = issue.get("route", "")
        protected_area = any(token in route for token in ["/wallet", "/payment", "/payout", "/kyc", "/auth", "/admin"])
        task_id = f"QA-{issue.get('issue_id', 'UNKNOWN')}"
        task_doc = _task(
            task_id,
            f"Visual QA: {issue.get('problem', 'Issue')[:96]}",
            issue.get("suggested_fix") or issue.get("problem") or "Visual-QA-Issue aus Automatisierung importiert.",
            PHASES[3]["title"],
            priority,
            "QA Lead",
            "In Review",
            "S",
            7,
            [issue.get("source_file") or route_file_hint(route, issue.get("category", ""))],
            [],
            [route],
            ["Viewport reproduzieren", "Vor/Nachher Screenshot prüfen"],
            ["Issue auf Route und Viewport nicht mehr sichtbar"],
            "High" if protected_area else "Medium",
            "High" if any(token in route for token in ["/wallet", "/payment"]) else "Low",
            "Critical" if priority == "P0 Critical" else "High",
            completion_percentage=0,
            notes=f"Viewport: {issue.get('viewport', '')} | Component: {issue.get('affected_component', '')} | Screenshot: {issue.get('before_screenshot', '')} | Branch: {branch} | Commit: {commit_hash}",
        )
        task_doc["external_issue_meta"] = {
            "severity": severity,
            "route": route,
            "viewport": issue.get("viewport", ""),
            "affected_component": issue.get("affected_component", ""),
            "suggested_fix": issue.get("suggested_fix", ""),
            "safe_to_auto_fix": bool(issue.get("safe_to_auto_fix", False)) and not protected_area,
            "before_screenshot": issue.get("before_screenshot", ""),
            "after_screenshot": issue.get("after_screenshot", ""),
            "protected_area": protected_area,
        }
        if protected_area:
            task_doc["notes"] = f"{task_doc['notes']} | Auto-Fix verboten für Wallet/Payment/KYC/Auth/Admin-Pfade."
        await db.master_roadmap_tasks.update_one({"task_id": task_id}, {"$set": task_doc}, upsert=True)


@router.get("/dashboard")
async def get_master_roadmap_dashboard(request: Request):
    await _require_admin(request)
    await _ensure_seed_data()
    tasks = await db.master_roadmap_tasks.find({}, {"_id": 0}).to_list(1200)
    tasks = sorted(tasks, key=lambda task: (PHASES.index(next(phase for phase in PHASES if phase["title"] == task["phase"])), PRIORITY_ORDER.index(task["priority"]) if task["priority"] in PRIORITY_ORDER else 99, STATUS_ORDER.index(task["status"]) if task["status"] in STATUS_ORDER else 99, task["task_id"]))
    feature_registry = await db.master_roadmap_feature_registry.find({}, {"_id": 0}).sort("module_key", 1).to_list(300)
    latest_qa = await db.visual_qa_runs.find_one({}, {"_id": 0}, sort=[("generated_at", -1)]) or {}
    release_gates = await _load_release_gates(tasks, latest_qa)
    return {
        "schema_version": SCHEMA_VERSION,
        "phases": _phase_summary(tasks),
        "tasks": tasks,
        "launch_readiness": _launch_readiness(tasks, release_gates),
        "release_gates": release_gates,
        "feature_registry": feature_registry,
        "ceo_view": _ceo_view(tasks, release_gates, latest_qa),
        "latest_visual_qa": latest_qa,
        "status_choices": STATUS_ORDER,
        "priority_choices": PRIORITY_ORDER,
        "workflow_status": _workflow_snapshot(latest_qa),
        "wallet_diagnostics": _wallet_diagnostics(),
        "environment_snapshot": _environment_snapshot(),
        "version_snapshot": _version_snapshot(),
        "final_acceptance": _final_acceptance_report(tasks, release_gates, feature_registry),
    }


@router.get("/final-acceptance")
async def get_final_acceptance(request: Request):
    await _require_admin(request)
    await _ensure_seed_data()
    tasks = await db.master_roadmap_tasks.find({}, {"_id": 0}).to_list(1200)
    feature_registry = await db.master_roadmap_feature_registry.find({}, {"_id": 0}).sort("module_key", 1).to_list(300)
    latest_qa = await db.visual_qa_runs.find_one({}, {"_id": 0}, sort=[("generated_at", -1)]) or {}
    release_gates = await _load_release_gates(tasks, latest_qa)
    return _final_acceptance_report(tasks, release_gates, feature_registry)


@router.patch("/tasks/{task_id}")
@limiter.limit(RATE_ADMIN_ACTION)
async def update_master_roadmap_task(task_id: str, request: Request, payload: dict[str, Any] = Body(...)):
    actor = await _require_admin(request)
    validated = TaskPatchRequest.model_validate(payload)
    updates = {key: value for key, value in validated.model_dump().items() if value is not None}
    if updates.get("status") and updates["status"] not in STATUS_ORDER:
        raise HTTPException(status_code=400, detail="Ungültiger Status")
    updates["updated_at"] = _now_iso()
    result = await db.master_roadmap_tasks.update_one({"task_id": task_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task nicht gefunden")
    await db.master_roadmap_audit.insert_one({"type": "task-update", "task_id": task_id, "actor": actor.get("email", "admin"), "payload": updates, "created_at": _now_iso()})
    return {"success": True}


@router.patch("/feature-registry/{module_key}")
@limiter.limit(RATE_ADMIN_ACTION)
async def update_feature_registry_item(module_key: str, request: Request, payload: dict[str, Any] = Body(...)):
    actor = await _require_admin(request)
    validated = FeatureRegistryPatchRequest.model_validate(payload)
    updates = {key: value for key, value in validated.model_dump().items() if value is not None}
    updates["updated_at"] = _now_iso()
    result = await db.master_roadmap_feature_registry.update_one({"module_key": module_key}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Modul nicht gefunden")
    await db.master_roadmap_audit.insert_one({"type": "feature-registry-update", "module_key": module_key, "actor": actor.get("email", "admin"), "payload": updates, "created_at": _now_iso()})
    return {"success": True}


@router.patch("/release-gates/{gate_key}")
@limiter.limit(RATE_ADMIN_ACTION)
async def update_release_gate(gate_key: str, request: Request, payload: dict[str, Any] = Body(...)):
    actor = await _require_admin(request)
    validated = ReleaseGatePatchRequest.model_validate(payload)
    updates = {key: value for key, value in validated.model_dump().items() if value is not None}
    if updates.get("status") and updates["status"] not in GATE_STATUS_ORDER:
        raise HTTPException(status_code=400, detail="Ungültiger Gate-Status")
    updates["updated_at"] = _now_iso()
    result = await db.master_roadmap_release_gates.update_one({"gate_key": gate_key}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Release Gate nicht gefunden")
    await db.master_roadmap_audit.insert_one({"type": "release-gate-update", "gate_key": gate_key, "actor": actor.get("email", "admin"), "payload": updates, "created_at": _now_iso()})
    return {"success": True}


@router.get("/investor-progress")
async def get_investor_progress(request: Request):
    await _allow_investor_view(request)
    await _ensure_seed_data()
    tasks = await db.master_roadmap_tasks.find({}, {"_id": 0}).to_list(1200)
    feature_registry = await db.master_roadmap_feature_registry.find({}, {"_id": 0}).sort("module_key", 1).to_list(300)
    return await _investor_view_payload(tasks, feature_registry)