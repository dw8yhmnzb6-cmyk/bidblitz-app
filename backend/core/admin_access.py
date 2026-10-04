"""Shared, existing BidBlitz admin policy. Never infers a role from a token."""


def can_manage_privileged_roles(admin: dict) -> bool:
    email = str(admin.get("canonical_email") or admin.get("email") or "").strip().lower()
    return admin.get("role") == "super_admin" or email == "admin@bidblitz.ae"
