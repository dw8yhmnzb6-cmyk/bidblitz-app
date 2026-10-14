"""DKV Enterprise read-adapter scaffold (DEV only).

No outbound network I/O. This prepares request construction and response
normalization only after DKV onboarding. Production HTTP execution remains
intentionally absent.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from services.dkv_enterprise import (
    DkvCustomerTenant,
    DkvDataset,
    DkvEnterpriseAccessBlocked,
)


@dataclass(frozen=True)
class DkvRequestPlan:
    customer_id: str
    dataset: DkvDataset
    query: dict[str, Any]
    method: str = "GET"
    content_type: str = "application/json"

    def __post_init__(self) -> None:
        if not self.customer_id.strip():
            raise ValueError("customer_id required")
        if self.method != "GET":
            raise ValueError("DKV V1 read scaffold supports GET only")


def build_request_plan(
    tenant: DkvCustomerTenant,
    dataset: DkvDataset,
    *,
    query: dict[str, Any] | None = None,
) -> DkvRequestPlan:
    if not tenant.permits(dataset):
        raise DkvEnterpriseAccessBlocked("DKV tenant/dataset is not authorized")
    safe_query = dict(query or {})
    # Never let secrets/credentials become query parameters in our plan.
    forbidden = {"password", "token", "api_key", "authorization", "secret"}
    if any(str(key).lower() in forbidden for key in safe_query):
        raise ValueError("credentials must not be supplied in DKV query parameters")
    return DkvRequestPlan(
        customer_id=tenant.customer_id,
        dataset=dataset,
        query=safe_query,
    )


def normalize_rows(dataset: DkvDataset, payload: Any) -> list[dict[str, Any]]:
    """Normalize only structural shape, not undocumented DKV field semantics."""
    if payload is None:
        return []
    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict):
        candidates = (
            payload.get("items"),
            payload.get("results"),
            payload.get("data"),
            payload.get("rows"),
        )
        rows = next((item for item in candidates if isinstance(item, list)), None)
        if rows is None:
            rows = [payload]
    else:
        raise ValueError("unsupported DKV response shape")

    normalized: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("DKV response row must be an object")
        normalized.append({
            "dataset": dataset.value,
            "raw": dict(row),
        })
    return normalized


class DkvReadExecutionBlocked(RuntimeError):
    pass


async def execute_request_plan(plan: DkvRequestPlan) -> None:
    """Deliberately blocks until official endpoint/auth details are configured."""
    raise DkvReadExecutionBlocked(
        "DKV outbound execution is disabled until official onboarding, "
        "production credentials and endpoint documentation are configured"
    )
