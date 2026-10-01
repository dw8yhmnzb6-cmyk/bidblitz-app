"""Server-side RBAC and scope isolation for The Eye."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, Mapping, Optional

from fastapi import HTTPException, Request

from core.security import get_current_user


THE_EYE_ROLES = frozenset({
    "super_admin",
    "admin",
    "project_admin",
    "site_manager",
    "technician",
    "customer",
    "partner",
    "public",
})
GLOBAL_ROLES = frozenset({"super_admin", "admin"})

_ROLE_SCOPE_PRIORITY = {
    "project_admin": ("project_id",),
    "site_manager": ("site_id",),
    "technician": ("site_id",),
    "customer": ("customer_id",),
    "partner": ("tenant_id", "project_id", "customer_id", "site_id"),
    "public": (),
}


def _clean_ids(value: Any) -> tuple[str, ...]:
    if value is None:
        return ()
    values: Iterable[Any]
    if isinstance(value, (list, tuple, set, frozenset)):
        values = value
    else:
        values = (value,)
    cleaned = []
    for item in values:
        text = str(item or "").strip()
        if text and text not in cleaned:
            cleaned.append(text)
    return tuple(cleaned)


def resolve_the_eye_role(user: Mapping[str, Any]) -> Optional[str]:
    explicit = str(user.get("the_eye_role") or "").strip().lower()
    if explicit in THE_EYE_ROLES:
        return explicit

    base_role = str(user.get("role") or "").strip().lower()
    if base_role == "admin":
        return "admin"
    if base_role in THE_EYE_ROLES:
        return base_role
    if user.get("is_technician") is True:
        return "technician"
    return None


def _scope_ids(user: Mapping[str, Any], logical_field: str) -> tuple[str, ...]:
    scope = user.get("the_eye_scope")
    scope = scope if isinstance(scope, Mapping) else {}
    plural = f"{logical_field[:-3]}_ids"
    candidates = (
        scope.get(plural),
        scope.get(logical_field),
        user.get(f"the_eye_{plural}"),
        user.get(f"the_eye_{logical_field}"),
        user.get(plural),
        user.get(logical_field),
    )

    merged: list[str] = []
    for candidate in candidates:
        for value in _clean_ids(candidate):
            if value not in merged:
                merged.append(value)
    return tuple(merged)


def _deny_all_query() -> Dict[str, Any]:
    return {"_id": {"$exists": False}}


def _merge_query(base: Dict[str, Any], scope_clause: Dict[str, Any]) -> Dict[str, Any]:
    if not base:
        return scope_clause
    return {"$and": [base, scope_clause]}


@dataclass(frozen=True)
class TheEyeAccess:
    user: Mapping[str, Any]
    role: str

    @property
    def unrestricted(self) -> bool:
        return self.role in GLOBAL_ROLES

    @property
    def actor_id(self) -> str:
        return str(
            self.user.get("_id")
            or self.user.get("id")
            or self.user.get("user_id")
            or self.user.get("email")
            or "unknown"
        )

    def scope_values(self, logical_field: str) -> tuple[str, ...]:
        return _scope_ids(self.user, logical_field)

    def _active_scope(
        self,
        field_map: Optional[Mapping[str, Optional[str]]] = None,
    ) -> tuple[Optional[str], tuple[str, ...]]:
        if self.unrestricted:
            return None, ()
        mapping = field_map or {}
        for logical in _ROLE_SCOPE_PRIORITY.get(self.role, ()):
            actual = mapping.get(logical, logical)
            values = self.scope_values(logical)
            if actual and values:
                return actual, values
        return None, ()

    def scope_query(
        self,
        base: Optional[Dict[str, Any]] = None,
        *,
        field_map: Optional[Mapping[str, Optional[str]]] = None,
    ) -> Dict[str, Any]:
        query = dict(base or {})
        if self.unrestricted:
            return query

        field, values = self._active_scope(field_map)
        if not field or not values:
            return _merge_query(query, _deny_all_query())

        clause: Dict[str, Any] = {field: {"$in": list(values)}}
        return _merge_query(query, clause)

    def assert_document(
        self,
        document: Mapping[str, Any],
        *,
        field_map: Optional[Mapping[str, Optional[str]]] = None,
    ) -> None:
        if self.unrestricted:
            return

        field, values = self._active_scope(field_map)
        if not field or not values:
            raise HTTPException(status_code=403, detail="The Eye scope is not configured")

        current: Any = document
        for part in field.split("."):
            if not isinstance(current, Mapping):
                current = None
                break
            current = current.get(part)

        if str(current or "") not in values:
            raise HTTPException(
                status_code=403,
                detail="Resource is outside your The Eye scope",
            )


async def require_the_eye_access(
    request: Request,
    allowed_roles: Optional[Iterable[str]] = None,
) -> TheEyeAccess:
    user = await get_current_user(request)
    role = resolve_the_eye_role(user)
    if role is None:
        raise HTTPException(status_code=403, detail="The Eye access required")

    if allowed_roles is not None:
        allowed = {str(item).strip().lower() for item in allowed_roles}
        if role not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient The Eye role")
    return TheEyeAccess(user=user, role=role)
