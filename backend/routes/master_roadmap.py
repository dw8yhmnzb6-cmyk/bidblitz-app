from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.investor_portal_auth import get_current_investor_account
from core.rate_limit import RATE_ADMIN_ACTION, limiter
from core.security import get_current_user

router = APIRouter(prefix="/api/master-roadmap", tags=["master-roadmap"])

BUILD_INFO_PATH = Path(__file__).resolve().parent.parent / "build_info.json"

STATUS_ORDER = ["Backlog", "Ready", "In Progress", "Blocked", "In Review", "Testing", "Ready for Release", "Completed", "Rejected"]
PRIORITY_ORDER = ["P0 Critical", "P1 Required", "P2 Important", "P3 Later"]


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
        if user.get("role") in {"admin", "investor", "reviewer", "merchant"}:
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


def _build_info() -> dict[str, Any]:
    try:
        import json
        if BUILD_INFO_PATH.exists():
            return json.loads(BUILD_INFO_PATH.read_text())
    except Exception:
        return {}
    return {}


def _task(task_id: str, title: str, description: str, phase: str, priority: str, responsible_role: str, status: str, effort: str, target_offset_days: int, frontend_files: list[str], backend_files: list[str], api_routes: list[str], test_requirements: list[str], acceptance_criteria: list[str], security_impact: str, financial_impact: str, release_risk: str, dependencies: Optional[list[str]] = None, completion_percentage: int = 0, notes: str = "") -> dict[str, Any]:
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
    return [
        _task("P1-001", "Fix wallet consistency completely", "Audit and unify wallet read/write logic across app, admin and backend reconciliation.", "PHASE 1 – LAUNCH BLOCKERS", "P0 Critical", "Backend Lead", "Blocked", "XL", 21, ["frontend/src/services/api.js", "frontend/src/pages/WalletPage.jsx"], ["backend/server.py", "backend/routes/wallet.py", "backend/routes/payment.py"], ["/api/wallet", "/api/wallet/balance", "/api/payment/send"], ["Canonical wallet regression tests", "Balance reconciliation checks"], ["One wallet source of truth verified", "No divergent wallet balances"], "High", "Critical", "Critical", completion_percentage=30, notes="Legacy wallet reads and suspicious restore logic still exist in codebase."),
        _task("P1-002", "Use one canonical EUR wallet balance source", "Remove parallel EUR balance paths and enforce one canonical source for UI and APIs.", "PHASE 1 – LAUNCH BLOCKERS", "P0 Critical", "Backend Lead", "In Progress", "L", 14, ["frontend/src/services/api.js"], ["backend/routes/wallet.py", "backend/routes/admin_wallet.py"], ["/api/wallet", "/api/wallet/balance", "/api/wallet/balance/total"], ["Wallet API contract test"], ["Frontend reads one canonical EUR balance source"], "High", "Critical", "Critical", dependencies=["P1-001"], completion_percentage=45),
        _task("P1-003", "Remove legacy wallet read paths", "Delete old wallet fallback reads after reconciliation is proven stable.", "PHASE 1 – LAUNCH BLOCKERS", "P0 Critical", "Backend Lead", "Ready", "M", 12, ["frontend/src/services/api.js"], ["backend/server.py", "backend/routes/admin_legacy_restore.py"], ["/api/wallet", "/api/admin-wallet/*"], ["Static code audit"], ["No legacy wallet read path remains in production code"], "High", "Critical", "Critical", dependencies=["P1-001", "P1-002"], completion_percentage=15),
        _task("P1-004", "Verify transaction and balance reconciliation", "Run reconciliation checks between transactions, wallet balances and admin corrections.", "PHASE 1 – LAUNCH BLOCKERS", "P0 Critical", "Finance QA", "Ready", "L", 18, ["frontend/src/pages/AdminWalletPage.jsx"], ["backend/routes/transactions.py", "backend/routes/admin_wallet.py"], ["/api/transactions", "/api/admin-wallet/*"], ["Reconciliation test suite"], ["Transaction totals match wallet totals"], "High", "Critical", "Critical", dependencies=["P1-001"], completion_percentage=10),
        _task("P1-005", "Separate test mode from production mode", "Ensure test toggles do not leak into production readiness flows.", "PHASE 1 – LAUNCH BLOCKERS", "P0 Critical", "Frontend Lead", "Blocked", "M", 10, ["frontend/.env", "frontend/src/config/testMode.js"], ["backend/server.py"], [], ["Environment audit"], ["Preview/test flags isolated from production readiness"], "High", "High", "High", completion_percentage=25, notes="KYC is intentionally disabled for testing and must be separated from production settings."),
        _task("P1-006", "Remove production TEST_MODE", "Eliminate production-style test mode toggles before launch release.", "PHASE 1 – LAUNCH BLOCKERS", "P0 Critical", "Frontend Lead", "Blocked", "S", 7, ["frontend/.env"], [], [], ["Env validation"], ["No production TEST_MODE style flag remains active"], "Medium", "High", "High", dependencies=["P1-005"], completion_percentage=0),
        _task("P1-007", "Remove hard-coded customer and recovery data", "Remove hard-coded recovery users, temporary passwords and restore snapshots from runtime code.", "PHASE 1 – LAUNCH BLOCKERS", "P0 Critical", "Security Lead", "Blocked", "L", 10, [], ["backend/server.py"], [], ["Secret scan", "Security review"], ["No hard-coded customer/recovery data in production runtime"], "Critical", "High", "Critical", completion_percentage=0),
        _task("P1-008", "Verify authentication and session security", "Review login, session refresh, cookie security and investor auth paths.", "PHASE 1 – LAUNCH BLOCKERS", "P0 Critical", "Security Lead", "In Review", "L", 14, ["frontend/src/pages/LoginPage.jsx"], ["backend/routes/auth.py", "backend/routes/investor_portal.py", "backend/core/security.py"], ["/api/auth/*", "/api/investor-portal/auth/*"], ["Auth regression tests"], ["Auth and session flows pass security verification"], "Critical", "High", "Critical", completion_percentage=55),
        _task("P1-009", "Verify Stripe payment and webhook flows", "Validate payment intent, top-up and webhook processing with traceable tests.", "PHASE 1 – LAUNCH BLOCKERS", "P0 Critical", "Payments Lead", "Ready", "L", 14, ["frontend/src/pages/WalletPage.jsx"], ["backend/routes/stripe.py", "backend/routes/bidblitz_pay.py"], ["/api/stripe/*", "/api/bidblitz-pay/*"], ["Stripe integration test", "Webhook replay test"], ["Payments and webhooks verified end-to-end"], "High", "Critical", "Critical", completion_percentage=20),
        _task("P1-010", "Verify backup and restore procedures", "Document and test backup export plus restore procedure for launch operations.", "PHASE 1 – LAUNCH BLOCKERS", "P0 Critical", "Platform Ops", "Backlog", "M", 10, [], ["backend/server.py"], [], ["Backup restore drill"], ["Backup and restore can be executed and verified"], "High", "High", "High", completion_percentage=0),
        _task("P1-011", "Fix current GitHub production deployment", "Repair CI/CD deployment path and verify release workflow reliability.", "PHASE 1 – LAUNCH BLOCKERS", "P0 Critical", "Platform Ops", "Blocked", "L", 14, [], [], [], ["Deployment dry run"], ["GitHub deployment workflow executes successfully"], "High", "High", "Critical", completion_percentage=5, notes="Current preview work does not prove production GitHub deployment health."),
        _task("P1-012", "Verify iOS production build", "Record, test and approve the native iOS production build.", "PHASE 1 – LAUNCH BLOCKERS", "P0 Critical", "Mobile Lead", "Testing", "M", 10, ["frontend/scripts/ios-prepare.js"], [], [], ["Physical iPhone build validation"], ["iOS production build status recorded and verified"], "Medium", "High", "High", completion_percentage=60),
        _task("P1-013", "Verify Android production build", "Record and resolve Android production build blockers before release.", "PHASE 1 – LAUNCH BLOCKERS", "P0 Critical", "Mobile Lead", "Blocked", "M", 10, [], [], [], ["Android release build validation"], ["Android production build status recorded and verified"], "Medium", "High", "High", completion_percentage=15, notes="Known Android AAB compatibility blocker still open."),
        _task("P2-001", "Login and registration", "Complete and stabilize user sign-up and login flows.", "PHASE 2 – CORE PRODUCT", "P1 Required", "Frontend Lead", "In Review", "M", 21, ["frontend/src/pages/LoginPage.jsx", "frontend/src/pages/RegisterPage.jsx"], ["backend/routes/auth.py"], ["/api/auth/register", "/api/auth/login"], ["Auth E2E tests"], ["User can register and log in reliably"], "High", "High", "High", completion_percentage=70),
        _task("P2-002", "User profile", "Finalize profile editing, security and deletion prerequisites.", "PHASE 2 – CORE PRODUCT", "P1 Required", "Frontend Lead", "Ready", "M", 21, ["frontend/src/pages/ProfilePage.jsx"], ["backend/routes/profile.py"], ["/api/profile/*"], ["Profile CRUD tests"], ["Profile data updates persist correctly"], "Medium", "Medium", "Medium", completion_percentage=40),
        _task("P2-003", "Wallet", "Complete wallet page using canonical source and stable history.", "PHASE 2 – CORE PRODUCT", "P1 Required", "Frontend Lead", "In Progress", "L", 21, ["frontend/src/pages/WalletPage.jsx"], ["backend/routes/wallet.py"], ["/api/wallet"], ["Wallet E2E tests"], ["Wallet shows canonical EUR balance and recent activity"], "High", "Critical", "Critical", completion_percentage=55),
        _task("P2-004", "Send money", "Stabilize peer-to-peer transfer flow.", "PHASE 2 – CORE PRODUCT", "P1 Required", "Backend Lead", "Ready", "M", 18, ["frontend/src/pages/SendMoneyPage.jsx"], ["backend/routes/payment.py"], ["/api/payment/send"], ["P2P transfer tests"], ["Transfers succeed with correct validation and audit"], "High", "Critical", "Critical", completion_percentage=45),
        _task("P2-005", "Receive money", "Stabilize receive flow and QR receiving experience.", "PHASE 2 – CORE PRODUCT", "P1 Required", "Frontend Lead", "Ready", "M", 18, ["frontend/src/pages/ReceiveMoneyPage.jsx"], ["backend/routes/p2p.py"], ["/api/p2p/qr/generate"], ["Receive/QR tests"], ["Receive flow works on mobile without format errors"], "Medium", "High", "High", completion_percentage=50),
        _task("P2-006", "QR payment", "Finalize merchant and person-to-person QR payment flows.", "PHASE 2 – CORE PRODUCT", "P1 Required", "Backend Lead", "Ready", "M", 18, ["frontend/src/pages/QrScannerPage.jsx"], ["backend/routes/payment.py", "backend/routes/p2p.py"], ["/api/payment/merchant-scan", "/api/scan/resolve"], ["QR scanning regression"], ["QR payment resolves and charges correctly"], "High", "Critical", "Critical", completion_percentage=45),
        _task("P2-007", "Transaction history", "Stabilize and verify transaction ledger visibility.", "PHASE 2 – CORE PRODUCT", "P1 Required", "Frontend Lead", "Ready", "S", 14, ["frontend/src/pages/TransactionsPage.jsx"], ["backend/routes/transactions.py"], ["/api/transactions"], ["Ledger pagination tests"], ["Users can review accurate transaction history"], "Medium", "High", "Medium", completion_percentage=50),
        _task("P2-008", "Merchant onboarding", "Complete merchant onboarding and approval handoff.", "PHASE 2 – CORE PRODUCT", "P1 Required", "Merchant Ops", "Backlog", "L", 30, ["frontend/src/pages/MerchantOnboardingPage.jsx"], ["backend/routes/merchant.py"], ["/api/merchant/*"], ["Merchant onboarding flow test"], ["Merchant can onboard and reach dashboard"], "Medium", "High", "High", completion_percentage=20),
        _task("P2-009", "Merchant dashboard", "Stabilize merchant overview, revenue and operations panels.", "PHASE 2 – CORE PRODUCT", "P1 Required", "Merchant Ops", "Backlog", "L", 30, ["frontend/src/pages/MerchantDashboardPage.jsx"], ["backend/routes/merchant_portal.py"], ["/api/merchant/dashboard"], ["Merchant dashboard tests"], ["Merchant dashboard shows production-safe data"], "Medium", "High", "High", completion_percentage=25),
        _task("P2-010", "Basic POS", "Finish minimal production-safe POS sales flow.", "PHASE 2 – CORE PRODUCT", "P1 Required", "POS Lead", "Backlog", "L", 30, ["frontend/src/pages/POSPage.jsx"], ["backend/routes/pos_system.py", "backend/routes/pos_payments.py"], ["/api/pos/*"], ["POS checkout tests"], ["Basic POS sale and receipt flow works"], "High", "Critical", "Critical", completion_percentage=20),
        _task("P2-011", "Admin dashboard", "Unify admin overview for launch operations.", "PHASE 2 – CORE PRODUCT", "P1 Required", "Operations Lead", "In Progress", "M", 21, ["frontend/src/pages/AdminPage.jsx"], ["backend/routes/admin.py"], ["/api/admin/*"], ["Admin smoke tests"], ["Admin can monitor launch-critical functions"], "Medium", "High", "High", completion_percentage=65),
        _task("P2-012", "Notifications", "Verify notification delivery and fallback logic.", "PHASE 2 – CORE PRODUCT", "P1 Required", "Backend Lead", "Ready", "M", 18, ["frontend/src/pages/NotificationsPage.jsx"], ["backend/routes/notifications.py"], ["/api/notifications/*"], ["Notification tests"], ["Users and admins receive notifications correctly"], "Medium", "Medium", "Medium", completion_percentage=40),
        _task("P2-013", "Support", "Stabilize support routes and escalation flows.", "PHASE 2 – CORE PRODUCT", "P1 Required", "Support Lead", "Ready", "S", 14, ["frontend/src/pages/SupportPage.jsx"], ["backend/routes/support.py"], ["/api/support/*"], ["Support request tests"], ["Support routes work and are reachable"], "Medium", "Low", "Medium", completion_percentage=45),
        _task("P2-014", "Legal pages", "Verify and harden production legal routes.", "PHASE 2 – CORE PRODUCT", "P1 Required", "Legal Ops", "Ready", "S", 14, ["frontend/src/pages/LegalPage.jsx"], ["backend/routes/legal.py"], ["/api/legal/*"], ["Route and content checks"], ["Legal routes exist and are not broken"], "Medium", "Low", "High", completion_percentage=40),
        _task("P2-015", "Account deletion", "Finalize compliant account deletion flow.", "PHASE 2 – CORE PRODUCT", "P1 Required", "Security Lead", "Backlog", "M", 21, ["frontend/src/pages/ProfilePage.jsx"], ["backend/routes/profile.py"], ["/api/profile/delete"], ["Deletion flow tests"], ["User can request compliant account deletion"], "High", "Medium", "High", completion_percentage=10),
        _task("P3-001", "Central design system", "Roll the shared design system across all core routes.", "PHASE 3 – QUALITY", "P1 Required", "Design Lead", "In Progress", "L", 21, ["frontend/src/design/tokens.js", "frontend/src/design/tokens.css"], [], [], ["Visual regression checks"], ["Core routes use shared tokens and components"], "Low", "Medium", "Medium", completion_percentage=65),
        _task("P3-002", "Mobile responsive cleanup", "Complete responsive cleanup on core launch routes.", "PHASE 3 – QUALITY", "P1 Required", "Frontend Lead", "In Progress", "L", 18, ["frontend/src/pages/AuctionsPage.jsx", "frontend/src/pages/TaxiPage.jsx", "frontend/src/pages/WalletPage.jsx"], [], [], ["Mobile viewport tests"], ["Core routes have no horizontal overflow or hidden actions"], "Low", "Medium", "High", completion_percentage=60),
        _task("P3-003", "Playwright tests", "Stabilize automated browser coverage for launch-critical flows.", "PHASE 3 – QUALITY", "P1 Required", "QA Lead", "In Progress", "M", 18, ["frontend/playwright.config.cjs", "frontend/tests/visual/auctions.spec.ts", "frontend/tests/visual/taxi.spec.ts"], [], [], ["Playwright suite"], ["Playwright suite passes on required routes and viewports"], "Medium", "Medium", "High", completion_percentage=45),
        _task("P3-004", "Visual QA", "Run visual QA reports with screenshots, severity and report upload.", "PHASE 3 – QUALITY", "P1 Required", "QA Lead", "In Progress", "M", 18, ["frontend/scripts/visual-qa/*", "frontend/src/pages/AdminVisualQaPage.jsx"], ["backend/routes/visual_qa.py"], ["/api/visual-qa/*"], ["Visual QA report generation"], ["Visual QA report exists with screenshots and issue states"], "Low", "Medium", "High", completion_percentage=55),
        _task("P3-005", "Translation audit", "Audit visible language consistency on core routes.", "PHASE 3 – QUALITY", "P1 Required", "QA Lead", "Ready", "S", 14, ["frontend/src/store/I18nContext.jsx"], [], [], ["Translation route audit"], ["German pages do not show blocked English labels"], "Low", "Low", "Medium", completion_percentage=35),
        _task("P3-006", "Accessibility audit", "Review contrast, labels and tap targets for launch flows.", "PHASE 3 – QUALITY", "P1 Required", "Design Lead", "Backlog", "M", 21, [], [], [], ["Accessibility audit"], ["Core flows meet baseline accessibility requirements"], "Medium", "Low", "Medium", completion_percentage=10),
        _task("P3-007", "Performance audit", "Measure build, bundle and route performance before launch.", "PHASE 3 – QUALITY", "P1 Required", "Platform Ops", "Backlog", "M", 21, [], [], [], ["Performance benchmark"], ["Critical routes meet agreed loading budget"], "Low", "Medium", "Medium", completion_percentage=5),
        _task("P3-008", "Security audit", "Run secret, auth and production-safety audit across repo.", "PHASE 3 – QUALITY", "P1 Required", "Security Lead", "Ready", "L", 21, [], ["backend/server.py"], [], ["Secret scan", "Security checklist"], ["No exposed secrets or critical runtime risks remain"], "Critical", "High", "Critical", completion_percentage=20),
        _task("P3-009", "API contract tests", "Cover launch-critical APIs with contract tests.", "PHASE 3 – QUALITY", "P1 Required", "Backend Lead", "Backlog", "M", 21, [], [], ["/api/auth/*", "/api/wallet/*", "/api/payment/*"], ["API contract suite"], ["Critical API contracts are versioned and tested"], "Medium", "High", "High", completion_percentage=5),
        _task("P3-010", "Database integrity checks", "Add integrity checks for launch-critical collections.", "PHASE 3 – QUALITY", "P1 Required", "Backend Lead", "Backlog", "M", 21, [], [], [], ["DB integrity checks"], ["Critical collections can be verified for consistency"], "High", "High", "High", completion_percentage=5),
        _task("P3-011", "Release checklist", "Document final launch checklist and ownership.", "PHASE 3 – QUALITY", "P1 Required", "Operations Lead", "Ready", "S", 10, [], [], [], ["Checklist review"], ["Launch checklist exists and is used before release"], "Low", "Medium", "High", completion_percentage=20),
        _task("P4-001", "Investor landing page", "Stabilize investor landing content and CTA capture.", "PHASE 4 – INVESTORS", "P2 Important", "Growth Lead", "In Progress", "M", 30, ["frontend/src/pages/InvestorPage.jsx"], ["backend/routes/investor_interest.py"], ["/api/investor-interest/lead"], ["Investor landing tests"], ["Approved investor landing page is live"], "Low", "Low", "Medium", completion_percentage=60),
        _task("P4-002", "Investor interest form", "Complete investor lead capture and follow-up status flow.", "PHASE 4 – INVESTORS", "P2 Important", "Growth Lead", "In Review", "M", 30, ["frontend/src/pages/InvestorPage.jsx"], ["backend/routes/investor_interest.py", "backend/routes/investor_portal.py"], ["/api/investor-interest/lead", "/api/investor-portal/admin/leads"], ["Lead capture regression"], ["Investor leads are stored and visible to admin"], "Medium", "Medium", "Medium", completion_percentage=70),
        _task("P4-003", "Investor portal", "Continue investor portal phase 2 hardening.", "PHASE 4 – INVESTORS", "P2 Important", "Investor Ops", "In Progress", "L", 30, ["frontend/src/pages/InvestorPortalPage.jsx"], ["backend/routes/investor_portal.py"], ["/api/investor-portal/*"], ["Investor portal E2E"], ["Approved investors can access restricted portal areas"], "Medium", "Medium", "Medium", completion_percentage=55),
        _task("P4-004", "Document center", "Finalize investor document center and acknowledgements.", "PHASE 4 – INVESTORS", "P2 Important", "Investor Ops", "Ready", "M", 30, ["frontend/src/pages/InvestorPortalDocumentsPage.jsx"], ["backend/routes/investor_portal.py"], ["/api/investor-portal/portal/documents"], ["Document access tests"], ["Investor document center works with approved files"], "Medium", "Low", "Medium", completion_percentage=45),
        _task("P4-005", "Investor updates", "Stabilize investor updates publishing workflow.", "PHASE 4 – INVESTORS", "P2 Important", "Investor Ops", "Ready", "M", 30, ["frontend/src/pages/InvestorPortalUpdatesPage.jsx"], ["backend/routes/investor_portal.py"], ["/api/investor-portal/admin/updates"], ["Update publish tests"], ["Approved investor updates are visible in portal"], "Low", "Low", "Medium", completion_percentage=50),
        _task("P4-006", "Meeting requests", "Finalize investor meeting request and scheduling flow.", "PHASE 4 – INVESTORS", "P2 Important", "Investor Ops", "Ready", "M", 30, ["frontend/src/pages/InvestorPortalMeetingsPage.jsx"], ["backend/routes/investor_portal.py"], ["/api/investor-portal/portal/meetings/*"], ["Meeting flow tests"], ["Meeting requests can be submitted and tracked"], "Low", "Low", "Medium", completion_percentage=45),
        _task("P4-007", "Admin investor leads", "Keep investor lead admin view operational and compliant.", "PHASE 4 – INVESTORS", "P2 Important", "Investor Ops", "In Review", "M", 30, ["frontend/src/pages/AdminInvestorLeadsPage.jsx"], ["backend/routes/investor_portal.py"], ["/api/investor-portal/admin/leads"], ["Admin lead workflow tests"], ["Admin can classify and follow up investor leads"], "Medium", "Low", "Medium", completion_percentage=70),
        _task("P4-008", "Risk information", "Prepare approved investor-safe risk information.", "PHASE 4 – INVESTORS", "P2 Important", "Legal Ops", "Backlog", "S", 30, [], [], [], ["Legal review"], ["Investor risk information is approved and published"], "High", "Low", "High", completion_percentage=0),
        _task("P4-009", "Financing-round overview", "Maintain approved financing-round summary for investor channels.", "PHASE 4 – INVESTORS", "P2 Important", "Investor Ops", "In Review", "S", 30, ["frontend/src/pages/InvestorDashboardPage.jsx"], ["backend/routes/investor_dashboard.py"], ["/api/investor-dashboard"], ["Investor dashboard tests"], ["Financing-round overview uses approved data only"], "Medium", "Low", "Medium", completion_percentage=60),
        _task("P4-010", "Investor presentation data", "Keep approved investor deck data synchronized with dashboard.", "PHASE 4 – INVESTORS", "P2 Important", "Investor Ops", "Ready", "S", 30, ["frontend/src/pages/AdminInvestorDashboardPage.jsx"], ["backend/routes/investor_dashboard.py"], ["/api/investor-dashboard/admin/config"], ["Config save tests"], ["Presentation data is editable and reviewable"], "Low", "Low", "Medium", completion_percentage=45),
        _task("P5-001", "Merchant acquisition", "Post-launch merchant acquisition engine.", "PHASE 5 – GROWTH", "P2 Important", "Growth Lead", "Backlog", "M", 45, [], [], [], ["Growth KPI checks"], ["Merchant acquisition plan approved"], "Low", "Medium", "Low"),
        _task("P5-002", "Promotions", "Controlled promotion system after launch stabilization.", "PHASE 5 – GROWTH", "P2 Important", "Growth Lead", "Backlog", "M", 45, [], [], [], ["Promo tests"], ["Promotions are launch-safe and measurable"], "Low", "Medium", "Low"),
        _task("P5-003", "Referral system", "Relaunch referrals after core flows are stable.", "PHASE 5 – GROWTH", "P2 Important", "Growth Lead", "Backlog", "M", 45, [], [], [], ["Referral tests"], ["Referral program has correct tracking"], "Low", "Medium", "Low"),
        _task("P5-004", "Loyalty", "Expand loyalty after launch blockers are closed.", "PHASE 5 – GROWTH", "P2 Important", "Growth Lead", "Backlog", "M", 45, [], [], [], ["Loyalty tests"], ["Loyalty logic is production-safe"], "Low", "Medium", "Low"),
        _task("P5-005", "Premium subscriptions", "Stage premium subscriptions after core stability.", "PHASE 5 – GROWTH", "P2 Important", "Growth Lead", "Backlog", "M", 45, [], [], [], ["Subscription tests"], ["Premium subscriptions are legally and technically ready"], "Medium", "High", "Medium"),
        _task("P5-006", "Analytics", "Broaden analytics after launch-critical instrumentation is stable.", "PHASE 5 – GROWTH", "P2 Important", "Data Lead", "Backlog", "S", 45, [], [], [], ["Analytics checks"], ["Growth analytics uses approved tracking"], "Low", "Low", "Low"),
        _task("P5-007", "Campaign tracking", "Add post-launch campaign attribution safely.", "PHASE 5 – GROWTH", "P2 Important", "Data Lead", "Backlog", "S", 45, [], [], [], ["Campaign test coverage"], ["Campaign tracking does not affect payments or auth"], "Low", "Low", "Low"),
        _task("P5-008", "Partner management", "Scale partner workflows only after core platform release.", "PHASE 5 – GROWTH", "P2 Important", "Partner Ops", "Backlog", "S", 45, [], [], [], ["Partner admin tests"], ["Partner workflows are documented and stable"], "Low", "Medium", "Low"),
        _task("P6-001", "Optional modules remain disabled before launch", "Keep optional modules disabled in production until core launch is stable.", "PHASE 6 – OPTIONAL MODULES", "P3 Later", "Operations Lead", "In Progress", "S", 60, [], [], [], ["Feature flag audit"], ["Optional modules are not production-enabled before core launch"], "Medium", "Medium", "High", completion_percentage=80, notes="Auctions, Taxi and other optional modules must stay behind controlled readiness."),
    ]


def _feature_registry_seed() -> list[dict[str, Any]]:
    def item(key: str, name: str, phase: str, enabled_dev: bool, enabled_test: bool, enabled_web: bool, enabled_ios: bool, enabled_android: bool, store_safe: bool, requires_kyc: bool, requires_payment_license: bool, requires_manual_approval: bool, notes: str = ""):
        return {
            "module_key": key,
            "name": name,
            "phase": phase,
            "enabled_in_development": enabled_dev,
            "enabled_in_test": enabled_test,
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
        item("login", "Login & Registrierung", "PHASE 2 – CORE PRODUCT", True, True, True, True, True, True, False, False, False),
        item("wallet", "Wallet", "PHASE 2 – CORE PRODUCT", True, True, False, False, False, False, False, True, True, "Bis zur Wallet-Härtung nicht produktionsreif."),
        item("send_money", "Geld senden", "PHASE 2 – CORE PRODUCT", True, True, False, False, False, False, False, True, True),
        item("receive_money", "Geld empfangen", "PHASE 2 – CORE PRODUCT", True, True, False, False, False, False, False, True, True),
        item("qr_payment", "QR Payment", "PHASE 2 – CORE PRODUCT", True, True, False, False, False, False, False, True, True),
        item("merchant", "Merchant", "PHASE 2 – CORE PRODUCT", True, True, False, False, False, False, True, True, True),
        item("pos", "POS", "PHASE 2 – CORE PRODUCT", True, True, False, False, False, False, True, True, True),
        item("admin", "Admin Dashboard", "PHASE 2 – CORE PRODUCT", True, True, False, False, False, True, False, False, True),
        item("notifications", "Notifications", "PHASE 2 – CORE PRODUCT", True, True, False, False, False, True, False, False, False),
        item("support", "Support", "PHASE 2 – CORE PRODUCT", True, True, True, True, True, True, False, False, False),
        item("legal", "Legal Pages", "PHASE 2 – CORE PRODUCT", True, True, True, True, True, True, False, False, False),
        item("investor_portal", "Investor Portal", "PHASE 4 – INVESTORS", True, True, False, False, False, True, False, False, True),
        item("auctions", "Auctions", "PHASE 6 – OPTIONAL MODULES", True, True, False, False, False, False, False, False, True, "Optional module stays disabled for production launch."),
        item("taxi", "Taxi", "PHASE 6 – OPTIONAL MODULES", True, True, False, False, False, False, False, True, True, "Optional module stays disabled for production launch."),
        item("scooter", "Scooter", "PHASE 6 – OPTIONAL MODULES", True, False, False, False, False, False, True, True, True),
        item("hotels", "Hotels", "PHASE 6 – OPTIONAL MODULES", False, False, False, False, False, False, False, False, True),
        item("flights", "Flights", "PHASE 6 – OPTIONAL MODULES", False, False, False, False, False, False, False, False, True),
        item("marketplace", "Marketplace", "PHASE 6 – OPTIONAL MODULES", True, False, False, False, False, False, False, False, True),
        item("kids", "Kids", "PHASE 6 – OPTIONAL MODULES", True, False, False, False, False, False, False, False, True),
        item("gaming", "Gaming", "PHASE 6 – OPTIONAL MODULES", True, False, False, False, False, False, False, False, True),
        item("crypto", "Crypto", "PHASE 6 – OPTIONAL MODULES", True, False, False, False, False, False, True, True, True),
        item("mining", "Mining", "PHASE 6 – OPTIONAL MODULES", True, False, False, False, False, False, False, False, True),
    ]


def _phase_seed() -> list[dict[str, Any]]:
    return [
        {"phase_id": "phase-1", "title": "PHASE 1 – LAUNCH BLOCKERS", "priority": "P0", "description": "Stabilize launch blockers before any release claim.", "sort_order": 1},
        {"phase_id": "phase-2", "title": "PHASE 2 – CORE PRODUCT", "priority": "P1", "description": "Complete the required core product set.", "sort_order": 2},
        {"phase_id": "phase-3", "title": "PHASE 3 – QUALITY", "priority": "P1", "description": "Hardening, QA and release controls.", "sort_order": 3},
        {"phase_id": "phase-4", "title": "PHASE 4 – INVESTORS", "priority": "P2", "description": "Restricted investor-facing delivery.", "sort_order": 4},
        {"phase_id": "phase-5", "title": "PHASE 5 – GROWTH", "priority": "P2", "description": "Growth only after the platform is controlled.", "sort_order": 5},
        {"phase_id": "phase-6", "title": "PHASE 6 – OPTIONAL MODULES", "priority": "P3", "description": "Optional modules stay disabled until launch stability is proven.", "sort_order": 6},
    ]


async def _ensure_seed_data():
    await db.master_roadmap_tasks.create_index("task_id", unique=True)
    await db.master_roadmap_tasks.create_index("phase")
    await db.master_roadmap_feature_registry.create_index("module_key", unique=True)
    await db.master_roadmap_release_gates.create_index("gate_key", unique=True)
    await db.master_roadmap_meta.create_index("meta_key", unique=True)
    await db.master_roadmap_audit.create_index("created_at")

    if await db.master_roadmap_tasks.count_documents({}) == 0:
        await db.master_roadmap_tasks.insert_many(_phase_task_defs())
    if await db.master_roadmap_feature_registry.count_documents({}) == 0:
        await db.master_roadmap_feature_registry.insert_many(_feature_registry_seed())
    if await db.master_roadmap_meta.count_documents({"meta_key": "phases"}) == 0:
        await db.master_roadmap_meta.insert_one({"meta_key": "phases", "items": _phase_seed(), "updated_at": _now_iso()})


def _readiness_color(statuses: list[str]) -> str:
    lowered = {status.lower() for status in statuses}
    if lowered == {"completed"}:
        return "green"
    if "blocked" in lowered or "backlog" in lowered or "ready" in lowered:
        return "red"
    return "yellow"


async def _release_gate_seed(tasks: list[dict[str, Any]], latest_qa: dict[str, Any]) -> list[dict[str, Any]]:
    build_info = _build_info()
    frontend_build_passes = (Path(__file__).resolve().parent.parent.parent / "frontend" / "build" / "index.html").exists()
    production_test_mode = (os.environ.get("REACT_APP_DISABLE_KYC") or "").lower() in {"1", "true", "yes", "on"}
    hardcoded_restore_present = True
    qa_passed = latest_qa.get("critical_issues", 1) == 0 and latest_qa.get("failed", 1) == 0 and latest_qa.get("pages_scanned", 0) > 0
    gates = [
        {"gate_key": "frontend_build", "label": "Frontend build passes", "status": "verified" if frontend_build_passes else "blocked", "recorded_value": str(frontend_build_passes).lower(), "notes": "Uses latest local production build output."},
        {"gate_key": "backend_tests", "label": "Backend tests pass", "status": "blocked", "recorded_value": "broken-suite", "notes": "Global backend pytest suite is still unstable."},
        {"gate_key": "wallet_tests", "label": "Wallet tests pass", "status": "blocked", "recorded_value": "not-verified", "notes": "Wallet consistency work is still open."},
        {"gate_key": "auth_tests", "label": "Authentication tests pass", "status": "incomplete", "recorded_value": "partial", "notes": "Auth/security review is still in progress."},
        {"gate_key": "playwright_tests", "label": "Playwright tests pass", "status": "verified" if qa_passed else "blocked", "recorded_value": latest_qa.get("status", "unknown"), "notes": "Visual browser suite depends on latest recorded QA run."},
        {"gate_key": "no_critical_visual_qa", "label": "No critical visual QA issues", "status": "verified" if latest_qa.get("critical_issues", 1) == 0 else "blocked", "recorded_value": str(latest_qa.get("critical_issues", 0)), "notes": "Derived from latest visual QA run."},
        {"gate_key": "no_exposed_secrets", "label": "No exposed secrets", "status": "blocked" if hardcoded_restore_present else "verified", "recorded_value": "legacy-runtime-data-present", "notes": "Legacy runtime restore data still exists in backend/server.py."},
        {"gate_key": "no_production_test_mode", "label": "No production TEST_MODE", "status": "blocked" if production_test_mode else "verified", "recorded_value": str(production_test_mode).lower(), "notes": "KYC test bypass is still active for testing."},
        {"gate_key": "legal_routes", "label": "No broken legal routes", "status": "incomplete", "recorded_value": "not-verified", "notes": "Legal routes need explicit production verification."},
        {"gate_key": "backup_verified", "label": "Backup verified", "status": "blocked", "recorded_value": "not-verified", "notes": "Restore drill has not been signed off."},
        {"gate_key": "rollback_plan", "label": "Rollback plan documented", "status": "incomplete", "recorded_value": "missing", "notes": "Rollback plan still needs formal documentation."},
        {"gate_key": "mobile_build_status", "label": "iOS and Android build status recorded", "status": "incomplete", "recorded_value": f"ios={build_info.get('ios_version', 'unknown')} android={build_info.get('android_version', 'unknown')}", "notes": "iOS/Android statuses are not yet fully verified for release."},
    ]
    return [{**gate, "updated_at": _now_iso()} for gate in gates]


async def _load_release_gates(tasks: list[dict[str, Any]], latest_qa: dict[str, Any]) -> list[dict[str, Any]]:
    existing = await db.master_roadmap_release_gates.find({}, {"_id": 0}).sort("gate_key", 1).to_list(100)
    if existing:
        return existing
    seeded = await _release_gate_seed(tasks, latest_qa)
    if seeded:
        await db.master_roadmap_release_gates.insert_many(seeded)
    return seeded


def _launch_readiness(tasks: list[dict[str, Any]]) -> dict[str, Any]:
    task_ids = {
        "wallet_safety": ["P1-001", "P1-002", "P1-003", "P1-004"],
        "authentication": ["P1-008", "P2-001"],
        "payments": ["P1-009", "P2-003", "P2-004", "P2-006"],
        "merchant": ["P2-008", "P2-009"],
        "pos": ["P2-010"],
        "backend": ["P1-004", "P3-009", "P3-010"],
        "web_production": ["P1-011", "P3-011"],
        "ios": ["P1-012"],
        "android": ["P1-013"],
        "security": ["P1-007", "P1-008", "P3-008"],
        "legal": ["P2-014"],
        "monitoring": ["P3-004"],
        "backups": ["P1-010"],
    }
    task_map = {task["task_id"]: task for task in tasks}
    items = []
    for key, ids in task_ids.items():
      statuses = [task_map[task_id]["status"] for task_id in ids if task_id in task_map]
      items.append({
          "key": key,
          "label": key.replace("_", " ").title(),
          "color": _readiness_color(statuses),
          "task_ids": ids,
          "statuses": statuses,
      })
    p0_open = [task for task in tasks if task["priority"] == "P0 Critical" and task["status"] != "Completed"]
    return {"items": items, "launch_ready": len(p0_open) == 0, "open_p0_tasks": len(p0_open)}


def _phase_summary(tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    phases = _phase_seed()
    result = []
    for phase in phases:
        phase_tasks = [task for task in tasks if task["phase"] == phase["title"]]
        completed = sum(1 for task in phase_tasks if task["status"] == "Completed")
        avg_progress = round(sum(task.get("completion_percentage", 0) for task in phase_tasks) / max(1, len(phase_tasks)))
        result.append({**phase, "task_count": len(phase_tasks), "completed": completed, "average_completion": avg_progress})
    return result


def _ceo_view(tasks: list[dict[str, Any]], release_gates: list[dict[str, Any]], latest_qa: dict[str, Any]) -> dict[str, Any]:
    build_info = _build_info()
    now = datetime.now(timezone.utc)
    this_week = (now - timedelta(days=7)).isoformat()[:10]
    completed_this_week = [task for task in tasks if task["status"] == "Completed" and (task.get("updated_at") or "")[:10] >= this_week]
    delayed = [task for task in tasks if task.get("target_date") and task["status"] != "Completed" and task["target_date"] < now.date().isoformat()]
    p0_blockers = [task for task in tasks if task["priority"] == "P0 Critical" and task["status"] != "Completed"]
    security_risks = [task for task in tasks if task["security_impact"] in {"High", "Critical"} and task["status"] != "Completed"][:10]
    financial_risks = [task for task in tasks if task["financial_impact"] in {"High", "Critical"} and task["status"] != "Completed"][:10]
    next_five = sorted([task for task in tasks if task["status"] != "Completed"], key=lambda task: (PRIORITY_ORDER.index(task["priority"]), STATUS_ORDER.index(task["status"])) )[:5]
    return {
        "p0_blockers": p0_blockers,
        "tasks_completed_this_week": completed_this_week,
        "tasks_delayed": delayed,
        "upcoming_release": next((gate for gate in release_gates if gate["gate_key"] == "frontend_build"), {}),
        "current_production_version": build_info.get("frontend_version") or "unknown",
        "current_ios_version": build_info.get("ios_version") or "unknown",
        "current_android_version": build_info.get("android_version") or "unknown",
        "open_security_risks": security_risks,
        "open_financial_risks": financial_risks,
        "next_five_priorities": next_five,
        "latest_visual_qa": latest_qa,
    }


async def _investor_view_payload(tasks: list[dict[str, Any]], feature_registry: list[dict[str, Any]]) -> dict[str, Any]:
    updates = await db.investor_updates.find({"is_active": True}, {"_id": 0, "title": 1, "summary": 1, "published_at": 1}).sort("published_at", -1).limit(6).to_list(6)
    build_info = _build_info()
    completed = [task for task in tasks if task["phase"] in {"PHASE 1 – LAUNCH BLOCKERS", "PHASE 2 – CORE PRODUCT", "PHASE 3 – QUALITY"} and task["status"] == "Completed"][:8]
    current_phase = next((phase for phase in _phase_summary(tasks) if phase["average_completion"] < 100), _phase_summary(tasks)[-1])
    next_milestones = [task for task in tasks if task["status"] in {"Ready", "In Progress", "Testing", "In Review"}][:8]
    product_status = [item for item in feature_registry if item["phase"] != "PHASE 6 – OPTIONAL MODULES"][:10]
    return {
        "completed_milestones": [{"task_id": task["task_id"], "title": task["title"], "phase": task["phase"]} for task in completed],
        "current_development_phase": {"title": current_phase["title"], "priority": current_phase["priority"], "average_completion": current_phase["average_completion"]},
        "next_planned_milestones": [{"task_id": task["task_id"], "title": task["title"], "phase": task["phase"], "target_date": task.get("target_date")} for task in next_milestones],
        "released_app_versions": {"web": build_info.get("frontend_version") or "unknown", "ios": build_info.get("ios_version") or "unknown", "android": build_info.get("android_version") or "unknown"},
        "product_status": [{"module_key": item["module_key"], "name": item["name"], "enabled_in_development": item["enabled_in_development"], "enabled_in_test": item["enabled_in_test"], "enabled_in_web_production": item["enabled_in_web_production"]} for item in product_status],
        "financing_use_categories": ["Technology", "Security", "Compliance", "Operations", "Go-to-market"],
        "approved_company_updates": updates,
    }


async def sync_visual_qa_issues_to_master_roadmap(issues: list[dict[str, Any]], commit_hash: str = "", branch: str = ""):
    await _ensure_seed_data()
    for issue in issues:
        severity = str(issue.get("severity", "medium")).lower()
        priority = "P0 Critical" if severity in {"critical", "high"} else "P1 Required"
        task_id = f"QA-{issue.get('issue_id', 'UNKNOWN')}"
        task_doc = _task(
            task_id,
            f"Visual QA: {issue.get('problem', 'Issue')[:96]}",
            issue.get("suggested_fix") or issue.get("problem") or "Visual QA issue imported from automation.",
            "PHASE 3 – QUALITY",
            priority,
            "QA Lead",
            "Testing" if issue.get("safe_to_auto_fix") else "In Review",
            "S",
            7,
            [issue.get("source_file") or route_file_hint(issue.get("route", ""), issue.get("category", ""))],
            [],
            [issue.get("route", "")],
            ["Replay Playwright route and verify screenshot issue."],
            ["Issue no longer visible on affected route and viewport."],
            "Medium",
            "Low",
            "High" if priority == "P0 Critical" else "Medium",
            completion_percentage=0,
            notes=f"Viewport: {issue.get('viewport', '')} | Component: {issue.get('affected_component', '')} | Screenshot: {issue.get('before_screenshot', '')} | Branch: {branch} | Commit: {commit_hash}",
        )
        task_doc["external_issue_meta"] = {
            "severity": severity,
            "route": issue.get("route", ""),
            "viewport": issue.get("viewport", ""),
            "affected_component": issue.get("affected_component", ""),
            "suggested_fix": issue.get("suggested_fix", ""),
            "safe_to_auto_fix": bool(issue.get("safe_to_auto_fix", False)),
            "before_screenshot": issue.get("before_screenshot", ""),
            "after_screenshot": issue.get("after_screenshot", ""),
        }
        await db.master_roadmap_tasks.update_one({"task_id": task_id}, {"$set": task_doc}, upsert=True)


def route_file_hint(route: str, category: str) -> str:
    if route.startswith("/taxi"):
        return "frontend/src/pages/TaxiPage.jsx"
    if route.startswith("/auction/"):
        return "frontend/src/components/auctions/AuctionDetail.jsx"
    if route.startswith("/auctions"):
        return "frontend/src/components/auctions/AuctionGridCard.jsx"
    if category == "translation":
        return "frontend/src/store/I18nContext.jsx"
    return "frontend/src/design/tokens.css"


@router.get("/dashboard")
async def get_master_roadmap_dashboard(request: Request):
    await _require_admin(request)
    await _ensure_seed_data()
    tasks = await db.master_roadmap_tasks.find({}, {"_id": 0}).sort([("priority", 1), ("phase", 1), ("task_id", 1)]).to_list(500)
    feature_registry = await db.master_roadmap_feature_registry.find({}, {"_id": 0}).sort("module_key", 1).to_list(200)
    latest_qa = await db.visual_qa_runs.find_one({}, {"_id": 0}, sort=[("generated_at", -1)]) or {}
    release_gates = await _load_release_gates(tasks, latest_qa)
    return {
        "phases": _phase_summary(tasks),
        "tasks": tasks,
        "launch_readiness": _launch_readiness(tasks),
        "release_gates": release_gates,
        "feature_registry": feature_registry,
        "ceo_view": _ceo_view(tasks, release_gates, latest_qa),
        "latest_visual_qa": latest_qa,
        "status_choices": STATUS_ORDER,
        "priority_choices": PRIORITY_ORDER,
    }


@router.patch("/tasks/{task_id}")
@limiter.limit(RATE_ADMIN_ACTION)
async def update_master_roadmap_task(task_id: str, request: Request, payload: TaskPatchRequest):
    actor = await _require_admin(request)
    updates = {key: value for key, value in payload.model_dump().items() if value is not None}
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
async def update_feature_registry_item(module_key: str, request: Request, payload: FeatureRegistryPatchRequest):
    actor = await _require_admin(request)
    updates = {key: value for key, value in payload.model_dump().items() if value is not None}
    updates["updated_at"] = _now_iso()
    result = await db.master_roadmap_feature_registry.update_one({"module_key": module_key}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Modul nicht gefunden")
    await db.master_roadmap_audit.insert_one({"type": "feature-registry-update", "module_key": module_key, "actor": actor.get("email", "admin"), "payload": updates, "created_at": _now_iso()})
    return {"success": True}


@router.patch("/release-gates/{gate_key}")
@limiter.limit(RATE_ADMIN_ACTION)
async def update_release_gate(gate_key: str, request: Request, payload: ReleaseGatePatchRequest):
    actor = await _require_admin(request)
    updates = {key: value for key, value in payload.model_dump().items() if value is not None}
    if updates.get("status") and updates["status"] not in {"verified", "incomplete", "blocked", "manual-approval"}:
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
    tasks = await db.master_roadmap_tasks.find({}, {"_id": 0}).sort([("priority", 1), ("phase", 1), ("task_id", 1)]).to_list(500)
    feature_registry = await db.master_roadmap_feature_registry.find({}, {"_id": 0}).sort("module_key", 1).to_list(200)
    return await _investor_view_payload(tasks, feature_registry)