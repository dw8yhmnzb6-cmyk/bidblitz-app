"""Read-only customer site scopes from trusted server-owned metadata.

No grant creation or tracking activation. The HTTP caller must authenticate the
principal before reading metadata. Client headers/body never supply ownership.
"""
from dataclasses import dataclass
import re
from uuid import UUID
from bson import ObjectId


def canonical_site_id(value):
    if not isinstance(value, str):
        raise ValueError("Canonical site identifier required")
    try:
        canonical = str(UUID(value))
    except (ValueError, AttributeError):
        raise ValueError("Canonical site identifier required") from None
    if value != canonical:
        raise ValueError("Canonical site identifier required")
    return canonical


def customer_user_id(user):
    """Use the authenticated database identity, never an analytics request field."""
    value = user.get("_id")
    if value is None:
        value = user.get("id")
    if not isinstance(value, (str, ObjectId)):
        raise ValueError("Authenticated database identity required")
    value = str(value)
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", value):
        raise ValueError("Invalid authenticated database identity")
    return value


@dataclass(frozen=True)
class CustomerSiteScope:
    site_id: str
    tenant_id: str
    display_name: str

    def public_summary(self):
        return {"site_id": self.site_id, "display_name": self.display_name}


def customer_site_scope(record, owner_user_id):
    """Reject inactive, unverified or inconsistent ownership records."""
    if (not isinstance(record, dict) or record.get("owner_user_id") != owner_user_id
            or record.get("status") != "active"
            or record.get("ownership_verified") is not True):
        raise ValueError("Site not available")
    site_id = canonical_site_id(record.get("site_id"))
    tenant_id = canonical_site_id(record.get("tenant_id"))
    name = record.get("display_name")
    if (not isinstance(name, str) or not name.strip() or len(name) > 100
            or any(ord(character) < 32 for character in name)):
        raise ValueError("Invalid site label")
    return CustomerSiteScope(site_id, tenant_id, name.strip())
