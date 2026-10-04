"""Audited access metadata, not a replacement for any endpoint's authorization.

Native entry points are fixed in code, never derived from an owner-edited URL.
Remote roles are required bindings, NOT evidence of the user's live access.
"""
from core.admin_access import can_manage_privileged_roles
from core.admin_project_defaults import PROJECTS
from core.config import TEST_MODE

NATIVE_PROJECT_PATHS = {p["id"]: p["admin_url"] for p in PROJECTS if p["status"] == "connected"}
REMOTE_REQUIRED_ROLES = {
    "eyes": "admin", "trade": "SUPER_ADMIN", "nex": "OWNER",
    "stack": "OWNER", "aion": "PLATFORM_ADMIN", "verify": "ADMIN", "bidtax": "super_admin", "conformexa": "platform_operator", "spy": "DEV_ADMIN", "remote": "owner", "veysca": "VEYSCA_ADMIN",
}
PROJECT_ALIASES = {
    "os": ["BidBlitz Builder"], "spy": ["BidBlitz Device", "Kids Control", "Kids Basic", "Kids Plus"],
    "tv": ["AK Stream TV"], "charging": ["Charging.BidBlitz", "iCharging"],
    "trade": ["Trades.BidBlitz.ae"], "bidtax": ["Tax", "TaxPilot"], "games": ["BidBlitz Games", "Games Studio", "Game Studio"],
}
SERVICE_MODULES = {
    "immobilien": "Immobilien", "freelancer": "Freelancer", "elearning": "E-Learning",
    "handwerker": "Handwerker", "gebrauchtwagen": "Gebrauchtwagen", "reinigung": "Reinigung",
    "umzug": "Umzug", "tierbetreuung": "Tierbetreuung", "streaming": "Streaming",
    "telemedizin": "Telemedizin", "dating": "Dating", "fitness": "Fitness",
    "reisen": "Reiseangebote", "ladesaeulen": "Ladesäulen", "scooter-abos": "Scooter-Abos",
}


def service_module_rights(user):
    """Mirror the existing generic CRUD gates; no account or collection changes."""
    is_admin = user.get("role") in {"admin", "super_admin"}
    rows = []
    for key, label in SERVICE_MODULES.items():
        operations = ["read", "create", "update", "delete"] if is_admin else []
        note = "Vorhandenes Service-CRUD; jede Aktion wird erneut im Backend geprüft."
        if key == "dating":
            operations = ["read", "moderate"] if is_admin else []
            note = "Nur echte Nutzerprofile ansehen und deaktivieren; keine Erstellung oder harte Löschung."
        elif key == "ladesaeulen" and not TEST_MODE:
            operations = ["read"] if is_admin else []
            note = "Live-OCPP-Geräte sind im generischen Editor nur lesbar."
        elif key == "scooter-abos":
            operations = ["read", "create", "update", "disable"] if is_admin else []
            note = "Abos werden deaktiviert, nicht hart gelöscht."
        rows.append({"id": key, "name": label, "operations": operations, "note": note,
                     "path": "/admin/modules", "module": key})
    return rows


def owner_access(user):
    return {"database_role": user.get("role"), "can_manage_privileged_roles": can_manage_privileged_roles(user),
            "can_cleanup_demo_data": bool(TEST_MODE and user.get("role") == "super_admin"),
            "test_mode": bool(TEST_MODE), "service_modules": service_module_rights(user),
            "notice": "Diese Übersicht ändert keine Kontorechte. Finanz-, Provider-, Sicherheits- und Freigabesperren bleiben wirksam."}


def project_access(project_id, user=None):
    native = project_id in NATIVE_PROJECT_PATHS
    return {"kind": "module" if native and project_id != "bidblitz" else "project",
            "aliases": PROJECT_ALIASES.get(project_id, []),
            "access_profile": {
                "scope": "bidblitz" if native else "separate_project",
                "role": (user or {}).get("role") if native else None,
                "required_role": None if native else REMOTE_REQUIRED_ROLES.get(project_id),
                "verification": "current_bidblitz_session" if native and user else "target_check_required",
                "effective_permissions": ["admin:navigate"] if native and (user or {}).get("role") in {"admin", "super_admin"} else [],
                "note": "Vorhandener Adminbereich; Aktionen prüfen ihre eigenen Rechte." if native else
                        "Lokale Kontenzuordnung und Rechte werden erst im Zielprojekt geprüft. Keine automatische Rechtevergabe.",
            }}
