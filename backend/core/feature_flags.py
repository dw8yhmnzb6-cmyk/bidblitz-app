from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Iterable

from core.database import db


DEFAULT_STATUSES = {"enabled", "disabled", "beta", "internal", "maintenance"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _role_of(user: Any) -> str:
    if isinstance(user, dict):
        return str(user.get("role") or "public")
    return str(user or "public")


def _user_id_of(user: Any) -> str:
    if isinstance(user, dict):
        return str(user.get("_id") or user.get("id") or user.get("email") or "system")
    return str(user or "system")


def _country_of(country: str | None) -> str:
    return (country or "all").strip().upper() or "ALL"


def _platform_of(platform: str | None) -> str:
    return (platform or "web").strip().lower() or "web"


def _base_flag(
    key: str,
    parent_key: str | None,
    name: str,
    description: str,
    type_: str,
    *,
    status: str = "enabled",
    enabled: bool = True,
    platforms: list[str] | None = None,
    roles: list[str] | None = None,
    countries: list[str] | None = None,
    excluded_countries: list[str] | None = None,
    show_in_navigation: bool = True,
    show_on_homepage: bool = False,
    show_in_search: bool = True,
    show_in_dashboard: bool = False,
    allow_direct_route: bool = True,
    allow_api: bool = True,
    maintenance_message: str = "Diese Funktion ist vorübergehend nicht verfügbar.",
) -> dict[str, Any]:
    now = _now_iso()
    return {
        "key": key,
        "parent_key": parent_key,
        "name": name,
        "description": description,
        "type": type_,
        "status": status,
        "enabled": enabled,
        "platforms": platforms or ["web", "ios", "android"],
        "roles": roles or ["public", "user", "merchant", "employee", "manager", "investor", "admin", "beta_tester"],
        "countries": countries or ["ALL"],
        "excluded_countries": excluded_countries or [],
        "show_in_navigation": show_in_navigation,
        "show_on_homepage": show_on_homepage,
        "show_in_search": show_in_search,
        "show_in_dashboard": show_in_dashboard,
        "allow_direct_route": allow_direct_route,
        "allow_api": allow_api,
        "maintenance_message": maintenance_message,
        "scheduled_start": None,
        "scheduled_end": None,
        "updated_by": "system",
        "updated_at": now,
        "created_at": now,
        "audit_version": 1,
    }


def _default_feature_seed() -> list[dict[str, Any]]:
    items = [
        _base_flag("merchant", None, "Merchant", "Merchant module", "module", roles=["merchant", "manager", "admin", "employee"], show_on_homepage=True, show_in_dashboard=True),
        _base_flag("merchant.pos", "merchant", "Kasse", "Primary merchant checkout", "page", roles=["merchant", "employee", "manager", "admin"], show_on_homepage=True, show_in_dashboard=True),
        _base_flag("merchant.pos.payment", "merchant.pos", "Zahlungen", "Checkout payment methods", "function", roles=["merchant", "employee", "manager", "admin"], show_in_navigation=False, show_in_search=False),
        _base_flag("merchant.pos.payment.cash", "merchant.pos.payment", "Bargeld", "Cash payments", "function", roles=["merchant", "employee", "manager", "admin"], show_in_navigation=False),
        _base_flag("merchant.pos.payment.card", "merchant.pos.payment", "Karte / NFC", "Card and NFC payments", "function", roles=["merchant", "employee", "manager", "admin"], show_in_navigation=False),
        _base_flag("merchant.pos.payment.tap_to_pay", "merchant.pos.payment", "Tap to Pay", "Tap to Pay payments", "function", status="internal", enabled=False, roles=["merchant", "manager", "admin"], show_in_navigation=False),
        _base_flag("merchant.pos.payment.wallet", "merchant.pos.payment", "BidBlitz Wallet", "Wallet payments", "function", roles=["merchant", "employee", "manager", "admin"], show_in_navigation=False),
        _base_flag("merchant.pos.payment.qr", "merchant.pos.payment", "QR-Code", "QR payments", "function", roles=["merchant", "employee", "manager", "admin"], show_in_navigation=False),
        _base_flag("merchant.pos.payment.voucher", "merchant.pos.payment", "Gutschein", "Voucher payments", "function", roles=["merchant", "employee", "manager", "admin"], show_in_navigation=False),
        _base_flag("merchant.pos.payment.invoice", "merchant.pos.payment", "Rechnung", "Invoice payments", "function", status="beta", enabled=False, roles=["merchant", "manager", "admin"], show_in_navigation=False),
        _base_flag("merchant.pos.discounts", "merchant.pos", "Rabatte", "Discounts in checkout", "function", roles=["merchant", "employee", "manager", "admin"], show_in_navigation=False),
        _base_flag("merchant.pos.tips", "merchant.pos", "Trinkgeld", "Tip selection", "function", roles=["merchant", "employee", "manager", "admin"], show_in_navigation=False),
        _base_flag("merchant.pos.refunds", "merchant.pos", "Rückerstattungen", "Refund flow", "function", roles=["merchant", "manager", "admin"], show_in_navigation=False),
        _base_flag("merchant.pos.customer_display", "merchant.pos", "Customer Display", "Customer facing display", "function", roles=["merchant", "employee", "manager", "admin"], show_in_navigation=False),
        _base_flag("merchant.pos.inventory", "merchant.pos", "Bestand", "Basic inventory", "function", roles=["merchant", "manager", "admin"], show_in_navigation=False),
        _base_flag("merchant.pos.staff_clock_in", "merchant.pos", "Mitarbeiter Login", "Staff clock in", "function", roles=["merchant", "employee", "manager", "admin"], show_in_navigation=False),
        _base_flag("merchant.setup", "merchant", "Merchant Setup", "Merchant onboarding wizard", "page", roles=["merchant", "manager", "admin"], show_in_navigation=False, show_in_search=False),
        _base_flag("merchant.sales", "merchant", "Verkäufe", "Merchant sales list", "page", roles=["merchant", "employee", "manager", "admin"], show_in_dashboard=True),
        _base_flag("merchant.products", "merchant", "Produkte", "Merchant products", "page", roles=["merchant", "employee", "manager", "admin"], show_in_dashboard=True),
        _base_flag("merchant.inventory", "merchant", "Lager", "Inventory", "page", roles=["merchant", "manager", "admin"]),
        _base_flag("merchant.staff", "merchant", "Mitarbeiter", "Staff admin", "page", roles=["merchant", "manager", "admin"]),
        _base_flag("merchant.reports", "merchant", "Berichte", "Advanced reports", "page", roles=["merchant", "manager", "admin"], show_in_navigation=True),
        _base_flag("merchant.payouts", "merchant", "Auszahlungen", "Payouts", "page", roles=["merchant", "admin"]),
        _base_flag("merchant.settings", "merchant", "Einstellungen", "Merchant settings", "page", roles=["merchant", "admin"]),
        _base_flag("auctions", None, "Auktionen", "Auctions module", "module", status="maintenance", enabled=False, roles=["user", "merchant", "admin", "beta_tester"], show_on_homepage=False),
        _base_flag("auctions.live", "auctions", "Live Auctions", "Live auctions", "page", status="maintenance", enabled=False, roles=["user", "admin", "beta_tester"]),
        _base_flag("auctions.bidding", "auctions", "Bidding", "Auction bidding", "function", status="maintenance", enabled=False, roles=["user", "admin", "beta_tester"], show_in_navigation=False),
        _base_flag("auctions.bid_packages", "auctions", "Bid Packages", "Bid packages", "function", status="maintenance", enabled=False, roles=["user", "admin", "beta_tester"], show_in_navigation=False),
        _base_flag("taxi", None, "Taxi", "Taxi module", "module", roles=["public", "user", "admin", "beta_tester"], show_on_homepage=True),
        _base_flag("scooter", None, "Scooter", "Scooter module", "module", roles=["public", "user", "admin", "beta_tester"], show_on_homepage=True),
        _base_flag("travel", None, "Travel", "Travel module", "module", status="beta", enabled=False, roles=["user", "admin", "beta_tester"], show_on_homepage=False),
        _base_flag("travel.flights", "travel", "Flights", "Flights page", "page", status="beta", enabled=False, roles=["user", "admin", "beta_tester"]),
        _base_flag("travel.flights.search", "travel.flights", "Flights Search", "Search flights", "function", status="beta", enabled=False, roles=["user", "admin", "beta_tester"], show_in_navigation=False),
        _base_flag("travel.flights.booking", "travel.flights", "Flights Booking", "Book flights", "function", status="beta", enabled=False, roles=["user", "admin", "beta_tester"], show_in_navigation=False),
        _base_flag("travel.flights.payment", "travel.flights", "Flights Payment", "Pay flights", "function", status="beta", enabled=False, roles=["user", "admin", "beta_tester"], show_in_navigation=False),
        _base_flag("travel.flights.cancel", "travel.flights", "Flights Cancel", "Cancel flights", "function", status="beta", enabled=False, roles=["user", "admin", "beta_tester"], show_in_navigation=False),
        _base_flag("travel.flights.refund", "travel.flights", "Flights Refund", "Refund flights", "function", status="beta", enabled=False, roles=["user", "admin", "beta_tester"], show_in_navigation=False),
        _base_flag("gaming", None, "Gaming", "Gaming module", "module", status="disabled", enabled=False, roles=["admin"], show_on_homepage=False),
        _base_flag("mining", None, "Mining", "Mining module", "module", status="disabled", enabled=False, roles=["admin"], show_on_homepage=False),
        _base_flag("crypto", None, "Crypto", "Crypto investment", "module", status="disabled", enabled=False, roles=["admin"], show_on_homepage=False),
        _base_flag("hotels", None, "Hotels", "Hotels module", "module", status="beta", enabled=False, roles=["user", "admin", "beta_tester"], show_on_homepage=False),
        _base_flag("investors", None, "Investors", "Investor module", "module", roles=["investor", "admin"], show_in_navigation=False, show_on_homepage=False, show_in_search=False),
        _base_flag("products.catalogue", None, "Product Catalogue", "Global product catalogue", "module", roles=["merchant", "employee", "manager", "admin"], show_in_search=False, show_in_navigation=False),
        _base_flag("products.category.beverages", "products.catalogue", "Getränke", "Beverages category", "product_category", roles=["merchant", "employee", "manager", "admin"], show_in_navigation=False),
        _base_flag("products.category.snacks", "products.catalogue", "Snacks", "Snacks category", "product_category", roles=["merchant", "employee", "manager", "admin"], show_in_navigation=False),
        _base_flag("products.sample.espresso", "products.category.beverages", "Espresso", "Sample product", "product", roles=["merchant", "employee", "manager", "admin"], show_in_navigation=False),
        _base_flag("products.sample.waffle", "products.category.snacks", "Waffel", "Sample product", "product", roles=["merchant", "employee", "manager", "admin"], show_in_navigation=False),
    ]
    return items


DEFAULT_FLAGS = {item["key"]: {"enabled": item["enabled"], "access": "all"} for item in _default_feature_seed()}


PRESETS = {
    "store_safe": {"enable": ["merchant", "merchant.pos", "merchant.sales", "merchant.products", "merchant.pos.payment.cash", "merchant.pos.payment.card", "merchant.pos.payment.qr", "merchant.pos.payment.wallet"], "disable": ["auctions", "auctions.live", "gaming", "mining", "crypto", "travel", "hotels"]},
    "public_beta": {"enable": ["merchant", "merchant.pos", "taxi", "scooter"], "beta": ["travel", "hotels"]},
    "internal_testing": {"enable": [item["key"] for item in _default_feature_seed()], "internal": ["merchant.pos.payment.tap_to_pay"]},
    "kosovo_pilot": {"enable": ["merchant", "merchant.pos", "merchant.setup"], "countries": ["XK"]},
    "germany_pilot": {"enable": ["merchant", "merchant.pos", "merchant.setup"], "countries": ["DE"]},
    "investor_demo": {"enable": ["investors"], "internal": []},
    "merchant_demo": {"enable": ["merchant", "merchant.pos", "merchant.sales", "merchant.products"], "beta": []},
    "minimal_v1": {"enable": ["merchant", "merchant.pos", "merchant.sales", "merchant.products", "merchant.pos.payment.cash", "merchant.pos.payment.card", "merchant.pos.payment.qr", "merchant.pos.payment.wallet"], "disable": ["merchant.pos.payment.tap_to_pay", "merchant.pos.payment.invoice", "merchant.pos.refunds", "merchant.reports", "auctions", "travel", "gaming", "mining", "crypto", "hotels"]},
    "retail": {"enable": ["merchant.pos.payment.cash", "merchant.pos.payment.card", "merchant.pos.payment.qr", "merchant.pos.discounts", "merchant.pos.inventory"], "disable": ["merchant.pos.payment.invoice"]},
    "restaurant": {"enable": ["merchant.pos.payment.cash", "merchant.pos.payment.card", "merchant.pos.payment.qr", "merchant.pos.tips", "merchant.pos.customer_display"], "disable": ["merchant.pos.payment.invoice"]},
    "cafe_eiscafe": {"enable": ["merchant.pos.payment.cash", "merchant.pos.payment.card", "merchant.pos.payment.qr", "merchant.pos.payment.wallet", "merchant.pos.tips", "merchant.pos.discounts", "merchant.pos.customer_display", "merchant.pos.inventory"], "disable": ["merchant.pos.payment.invoice"]},
    "fast_food": {"enable": ["merchant.pos.payment.cash", "merchant.pos.payment.card", "merchant.pos.payment.qr", "merchant.pos.customer_display"], "disable": ["merchant.pos.payment.invoice"]},
    "phone_accessories": {"enable": ["merchant.pos.payment.cash", "merchant.pos.payment.card", "merchant.pos.inventory"], "disable": ["merchant.pos.tips"]},
    "supermarket": {"enable": ["merchant.pos.payment.cash", "merchant.pos.payment.card", "merchant.pos.inventory", "merchant.pos.discounts"], "disable": ["merchant.pos.tips"]},
    "hairdresser": {"enable": ["merchant.pos.payment.cash", "merchant.pos.payment.card", "merchant.pos.payment.wallet", "merchant.pos.tips"], "disable": ["merchant.pos.inventory"]},
    "mobile_seller": {"enable": ["merchant.pos.payment.cash", "merchant.pos.payment.card", "merchant.pos.payment.qr", "merchant.pos.payment.wallet"], "disable": ["merchant.pos.inventory"]},
    "swimming_pool": {"enable": ["merchant.pos.payment.cash", "merchant.pos.payment.card", "merchant.pos.payment.qr", "merchant.pos.payment.wallet", "merchant.pos.customer_display"], "disable": ["merchant.pos.payment.invoice"]},
    "service_business": {"enable": ["merchant.pos.payment.cash", "merchant.pos.payment.card", "merchant.pos.payment.invoice"], "disable": ["merchant.pos.inventory"]},
}


class FeatureFlagService:
    async def ensure_seeded(self) -> None:
        if await db.feature_flags.count_documents({}) > 0:
            return
        docs = _default_feature_seed()
        if docs:
            await db.feature_flags.insert_many(docs)

    async def list_flags(self) -> list[dict[str, Any]]:
        await self.ensure_seeded()
        return await db.feature_flags.find({}, {"_id": 0}).sort([("key", 1)]).to_list(3000)

    async def get_flag(self, key: str) -> dict[str, Any] | None:
        await self.ensure_seeded()
        return await db.feature_flags.find_one({"key": key}, {"_id": 0})

    def _is_within_schedule(self, flag: dict[str, Any]) -> bool:
        now = datetime.now(timezone.utc)
        start = flag.get("scheduled_start")
        end = flag.get("scheduled_end")
        try:
            if start and datetime.fromisoformat(str(start).replace("Z", "+00:00")) > now:
                return False
            if end and datetime.fromisoformat(str(end).replace("Z", "+00:00")) < now:
                return False
        except Exception:
            return False
        return True

    async def _resolve(self, key: str) -> list[dict[str, Any]]:
        await self.ensure_seeded()
        flag = await self.get_flag(key)
        chain = []
        while flag:
            chain.insert(0, flag)
            parent = flag.get("parent_key")
            flag = await self.get_flag(parent) if parent else None
        return chain

    def _evaluate_chain(self, chain: list[dict[str, Any]], user: Any, platform: str | None, country: str | None, for_api: bool = False, for_route: bool = False) -> tuple[bool, dict[str, Any] | None]:
        role = _role_of(user)
        platform_name = _platform_of(platform)
        country_name = _country_of(country)
        last = chain[-1] if chain else None
        for flag in chain:
            if not flag.get("enabled", True):
                return False, last
            status = str(flag.get("status") or "enabled").lower()
            if status == "disabled":
                return False, last
            if status == "internal" and role not in {"admin", "manager"}:
                return False, last
            if status == "beta" and role not in {"admin", "beta_tester", "merchant", "manager"}:
                return False, last
            if status == "maintenance":
                return False, last
            if platform_name not in [str(x).lower() for x in (flag.get("platforms") or [])]:
                return False, last
            roles = [str(x) for x in (flag.get("roles") or [])]
            if role not in roles and "all" not in [r.lower() for r in roles]:
                return False, last
            countries = [str(x).upper() for x in (flag.get("countries") or ["ALL"])]
            excluded = [str(x).upper() for x in (flag.get("excluded_countries") or [])]
            if country_name in excluded:
                return False, last
            if "ALL" not in countries and country_name not in countries:
                return False, last
            if not self._is_within_schedule(flag):
                return False, last
            if for_route and not flag.get("allow_direct_route", True):
                return False, last
            if for_api and not flag.get("allow_api", True):
                return False, last
        return True, last

    async def is_enabled(self, key: str, user: Any = None, platform: str | None = None, country: str | None = None) -> bool:
        chain = await self._resolve(key)
        if not chain:
            return True
        return self._evaluate_chain(chain, user, platform, country)[0]

    async def can_access_route(self, key: str, user: Any = None, platform: str | None = None, country: str | None = None) -> bool:
        chain = await self._resolve(key)
        if not chain:
            return True
        return self._evaluate_chain(chain, user, platform, country, for_route=True)[0]

    async def can_access_api(self, key: str, user: Any = None, platform: str | None = None, country: str | None = None) -> bool:
        chain = await self._resolve(key)
        if not chain:
            return True
        return self._evaluate_chain(chain, user, platform, country, for_api=True)[0]

    async def get_visible_navigation(self, user: Any = None, platform: str | None = None, country: str | None = None) -> list[dict[str, Any]]:
        flags = await self.list_flags()
        result = []
        for flag in flags:
            if not flag.get("show_in_navigation"):
                continue
            if await self.can_access_route(flag["key"], user, platform, country):
                result.append(flag)
        return result

    async def get_visible_modules(self, user: Any = None, platform: str | None = None, country: str | None = None) -> list[dict[str, Any]]:
        flags = await self.list_flags()
        return [flag for flag in flags if flag.get("type") == "module" and await self.is_enabled(flag["key"], user, platform, country)]

    async def get_visible_products(self, user: Any = None, platform: str | None = None, country: str | None = None) -> list[dict[str, Any]]:
        flags = await self.list_flags()
        return [flag for flag in flags if flag.get("type") == "product" and await self.is_enabled(flag["key"], user, platform, country)]

    async def _audit(self, key: str, actor: Any, old_value: dict[str, Any] | None, new_value: dict[str, Any], reason: str = "", ip: str = "") -> None:
        await db.feature_flag_audit.insert_one({
            "audit_id": f"FFA-{key}-{int(datetime.now(timezone.utc).timestamp())}",
            "key": key,
            "changed_by": _user_id_of(actor),
            "old_value": old_value,
            "new_value": new_value,
            "changed_at": _now_iso(),
            "ip": ip,
            "reason": reason,
        })

    async def create_feature(self, payload: dict[str, Any], actor: Any, ip: str = "") -> dict[str, Any]:
        await self.ensure_seeded()
        key = payload["key"]
        if await self.get_flag(key):
            raise ValueError("Feature already exists")
        base = _base_flag(
            key=key,
            parent_key=payload.get("parent_key"),
            name=payload.get("name") or key,
            description=payload.get("description") or "",
            type_=payload.get("type") or "function",
        )
        base.update({k: v for k, v in payload.items() if v is not None})
        base["updated_by"] = _user_id_of(actor)
        base["updated_at"] = _now_iso()
        base["created_at"] = _now_iso()
        await db.feature_flags.insert_one(base)
        await self._audit(key, actor, None, base, payload.get("reason", "create_feature"), ip)
        return base

    async def update_feature(self, key: str, payload: dict[str, Any], actor: Any, ip: str = "") -> dict[str, Any]:
        await self.ensure_seeded()
        existing = await self.get_flag(key)
        if not existing:
            raise ValueError("Feature not found")
        updates = {k: v for k, v in payload.items() if v is not None}
        updates["updated_by"] = _user_id_of(actor)
        updates["updated_at"] = _now_iso()
        updates["audit_version"] = int(existing.get("audit_version", 1) or 1) + 1
        merged = deepcopy(existing)
        merged.update(updates)
        await db.feature_flags.update_one({"key": key}, {"$set": updates})
        await self._audit(key, actor, existing, merged, payload.get("reason", "update_feature"), ip)
        return merged

    async def set_status(self, key: str, status: str, actor: Any, *, enabled: bool | None = None, reason: str = "", scheduled_start: str | None = None, scheduled_end: str | None = None, ip: str = "") -> dict[str, Any]:
        payload = {"status": status, "reason": reason}
        if enabled is not None:
            payload["enabled"] = enabled
        if scheduled_start is not None:
            payload["scheduled_start"] = scheduled_start
        if scheduled_end is not None:
            payload["scheduled_end"] = scheduled_end
        return await self.update_feature(key, payload, actor, ip)

    async def bulk_action(self, keys: Iterable[str], action: str, actor: Any, ip: str = "", **kwargs: Any) -> list[dict[str, Any]]:
        results = []
        for key in keys:
            if action == "enable":
                results.append(await self.set_status(key, "enabled", actor, enabled=True, reason=kwargs.get("reason", "bulk_enable"), ip=ip))
            elif action == "disable":
                results.append(await self.set_status(key, "disabled", actor, enabled=False, reason=kwargs.get("reason", "bulk_disable"), ip=ip))
            elif action == "maintenance":
                results.append(await self.set_status(key, "maintenance", actor, enabled=True, reason=kwargs.get("reason", "bulk_maintenance"), ip=ip))
            elif action == "web_only":
                results.append(await self.update_feature(key, {"platforms": ["web"], "reason": kwargs.get("reason", "web_only")}, actor, ip))
            elif action == "beta_only":
                results.append(await self.update_feature(key, {"roles": ["beta_tester", "admin"], "status": "beta", "reason": kwargs.get("reason", "beta_only")}, actor, ip))
            elif action == "selected_countries":
                results.append(await self.update_feature(key, {"countries": kwargs.get("countries", []), "reason": kwargs.get("reason", "country_limited")}, actor, ip))
        return results

    async def apply_preset(self, preset_name: str, actor: Any, ip: str = "") -> list[dict[str, Any]]:
        preset = PRESETS.get(preset_name)
        if not preset:
            raise ValueError("Preset not found")
        results = []
        for key in preset.get("enable", []):
            results.append(await self.set_status(key, "enabled", actor, enabled=True, reason=f"preset:{preset_name}", ip=ip))
        for key in preset.get("disable", []):
            results.append(await self.set_status(key, "disabled", actor, enabled=False, reason=f"preset:{preset_name}", ip=ip))
        for key in preset.get("beta", []):
            results.append(await self.set_status(key, "beta", actor, enabled=True, reason=f"preset:{preset_name}", ip=ip))
        for key in preset.get("internal", []):
            results.append(await self.set_status(key, "internal", actor, enabled=True, reason=f"preset:{preset_name}", ip=ip))
        if preset.get("countries"):
            for key in preset.get("enable", []):
                results.append(await self.update_feature(key, {"countries": preset["countries"], "reason": f"preset:{preset_name}"}, actor, ip))
        return results

    async def get_audit(self, key: str | None = None) -> list[dict[str, Any]]:
        query = {"key": key} if key else {}
        return await db.feature_flag_audit.find(query, {"_id": 0}).sort([("changed_at", -1)]).to_list(1000)

    async def rollback(self, key: str, audit_id: str, actor: Any, ip: str = "") -> dict[str, Any]:
        audit = await db.feature_flag_audit.find_one({"audit_id": audit_id, "key": key}, {"_id": 0})
        if not audit or not audit.get("old_value"):
            raise ValueError("Rollback snapshot not found")
        old_value = audit["old_value"]
        return await self.update_feature(key, {**old_value, "reason": f"rollback:{audit_id}"}, actor, ip)


service = FeatureFlagService()


async def get_all_flags() -> dict[str, dict[str, Any]]:
    flags = await service.list_flags()
    return {
        flag["key"]: {
            "enabled": flag.get("enabled", True),
            "status": flag.get("status", "enabled"),
            "access": "all" if "public" in flag.get("roles", []) else ",".join(flag.get("roles", [])),
            "show_in_navigation": flag.get("show_in_navigation", False),
        }
        for flag in flags
    }


async def update_flag(flag_name: str, enabled: bool | None = None, access: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"reason": "legacy_admin_update"}
    if enabled is not None:
        payload["enabled"] = enabled
        payload["status"] = "enabled" if enabled else "disabled"
    if access:
        payload["roles"] = [part.strip() for part in access.split(",") if part.strip()]
    return await service.update_feature(flag_name, payload, actor="legacy_admin")