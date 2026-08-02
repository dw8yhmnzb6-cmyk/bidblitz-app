from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.audit import get_client_info
from core.feature_flags import PRESETS, service
from core.security import get_current_user

router = APIRouter(tags=["feature-flags"])


class FeaturePayload(BaseModel):
    key: str | None = None
    parent_key: str | None = None
    name: str | None = None
    description: str | None = None
    type: str | None = None
    status: str | None = None
    enabled: bool | None = None
    platforms: list[str] | None = None
    roles: list[str] | None = None
    countries: list[str] | None = None
    excluded_countries: list[str] | None = None
    show_in_navigation: bool | None = None
    show_on_homepage: bool | None = None
    show_in_search: bool | None = None
    show_in_dashboard: bool | None = None
    allow_direct_route: bool | None = None
    allow_api: bool | None = None
    maintenance_message: str | None = None
    scheduled_start: str | None = None
    scheduled_end: str | None = None
    reason: str | None = None


class FeatureBulkPayload(BaseModel):
    keys: list[str] = Field(default_factory=list)
    action: str
    reason: str | None = None
    countries: list[str] | None = None


class FeaturePresetPayload(BaseModel):
    preset: str


class FeatureRollbackPayload(BaseModel):
    audit_id: str


async def _optional_user(request: Request):
    try:
        return await get_current_user(request)
    except Exception:
        return {"role": "public"}


async def _require_admin(request: Request):
    user = await get_current_user(request)
    if (user.get("role") or "") != "admin":
        raise HTTPException(status_code=403, detail="Admin Zugriff erforderlich")
    return user


def _context_from_request(request: Request) -> tuple[str, str]:
    country = request.headers.get("x-country") or request.query_params.get("country") or "ALL"
    platform = request.headers.get("x-platform") or request.query_params.get("platform") or "web"
    return platform, country


@router.get("/api/feature-flags")
async def legacy_feature_flags(request: Request):
    user = await _optional_user(request)
    platform, country = _context_from_request(request)
    flags = await service.list_flags()
    result = {}
    for flag in flags:
        result[flag["key"]] = {
            "enabled": await service.is_enabled(flag["key"], user, platform, country),
            "status": flag.get("status"),
            "access": ",".join(flag.get("roles", [])),
        }
    return {"flags": result}


@router.get("/api/features/public")
async def get_public_features(request: Request):
    user = await _optional_user(request)
    platform, country = _context_from_request(request)
    flags = await service.list_flags()
    visible = []
    for flag in flags:
        if await service.is_enabled(flag["key"], user, platform, country):
            visible.append(flag)
    return {"features": visible, "presets": sorted(PRESETS.keys())}


@router.get("/api/features/navigation")
async def get_navigation_features(request: Request):
    user = await _optional_user(request)
    platform, country = _context_from_request(request)
    items = await service.get_visible_navigation(user, platform, country)
    return {"items": items}


@router.get("/api/features/check/{key:path}")
async def check_feature(request: Request, key: str):
    user = await _optional_user(request)
    platform, country = _context_from_request(request)
    flag = await service.get_flag(key)
    return {
        "key": key,
        "exists": bool(flag),
        "enabled": await service.is_enabled(key, user, platform, country),
        "allow_route": await service.can_access_route(key, user, platform, country),
        "allow_api": await service.can_access_api(key, user, platform, country),
        "flag": flag,
    }


@router.get("/api/admin/features")
async def admin_get_features(request: Request):
    await _require_admin(request)
    flags = await service.list_flags()
    return {"features": flags, "presets": PRESETS, "audit": await service.get_audit()}


@router.post("/api/admin/features")
async def admin_create_feature(request: Request, payload: FeaturePayload):
    admin = await _require_admin(request)
    ip, _ua = get_client_info(request)
    try:
        result = await service.create_feature(payload.model_dump(), admin, ip)
        return {"feature": result}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/api/admin/features/{key:path}")
async def admin_update_feature(key: str, request: Request, payload: FeaturePayload):
    admin = await _require_admin(request)
    ip, _ua = get_client_info(request)
    try:
        result = await service.update_feature(key, payload.model_dump(), admin, ip)
        return {"feature": result}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/api/admin/features/{key:path}/enable")
async def admin_enable_feature(key: str, request: Request):
    admin = await _require_admin(request)
    ip, _ua = get_client_info(request)
    result = await service.set_status(key, "enabled", admin, enabled=True, reason="manual_enable", ip=ip)
    return {"feature": result}


@router.post("/api/admin/features/{key:path}/disable")
async def admin_disable_feature(key: str, request: Request):
    admin = await _require_admin(request)
    ip, _ua = get_client_info(request)
    result = await service.set_status(key, "disabled", admin, enabled=False, reason="manual_disable", ip=ip)
    return {"feature": result}


@router.post("/api/admin/features/{key:path}/maintenance")
async def admin_maintenance_feature(key: str, request: Request, payload: FeaturePayload):
    admin = await _require_admin(request)
    ip, _ua = get_client_info(request)
    result = await service.set_status(key, "maintenance", admin, enabled=True, reason=payload.reason or "maintenance", ip=ip)
    return {"feature": result}


@router.post("/api/admin/features/{key:path}/schedule")
async def admin_schedule_feature(key: str, request: Request, payload: FeaturePayload):
    admin = await _require_admin(request)
    ip, _ua = get_client_info(request)
    result = await service.set_status(key, payload.status or "enabled", admin, enabled=payload.enabled, reason=payload.reason or "schedule", scheduled_start=payload.scheduled_start, scheduled_end=payload.scheduled_end, ip=ip)
    return {"feature": result}


@router.post("/api/admin/features/bulk")
async def admin_bulk_feature_action(request: Request, payload: FeatureBulkPayload):
    admin = await _require_admin(request)
    ip, _ua = get_client_info(request)
    result = await service.bulk_action(payload.keys, payload.action, admin, ip, reason=payload.reason, countries=payload.countries)
    return {"features": result}


@router.post("/api/admin/features/presets/apply")
async def admin_apply_preset(request: Request, payload: FeaturePresetPayload):
    admin = await _require_admin(request)
    ip, _ua = get_client_info(request)
    try:
        result = await service.apply_preset(payload.preset, admin, ip)
        return {"features": result}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/api/admin/features/audit")
async def admin_feature_audit(request: Request, key: str | None = None):
    await _require_admin(request)
    return {"audit": await service.get_audit(key)}


@router.post("/api/admin/features/{key:path}/rollback")
async def admin_feature_rollback(key: str, request: Request, payload: FeatureRollbackPayload):
    admin = await _require_admin(request)
    ip, _ua = get_client_info(request)
    try:
        result = await service.rollback(key, payload.audit_id, admin, ip)
        return {"feature": result}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc