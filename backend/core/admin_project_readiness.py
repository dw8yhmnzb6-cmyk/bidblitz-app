"""Secret-free issuer diagnostics, never proof of remote account privileges.

These checks are local and read-only. No receiver is contacted, no credential is
issued, and no catalogue field can attest to deployment or account verification.
"""
from core.admin_project_access import REMOTE_REQUIRED_ROLES

RECEIVER_SETUP = {
    "eyes": {"identity_setting": "EYES_BIDBLITZ_LOCAL_ADMIN_EMAIL", "owner_setting": "EYES_BIDBLITZ_OWNER_ID", "secret_setting": "EYES_BIDBLITZ_SSO_SHARED_SECRET", "migration": "Vorhandene SQLite-Nonce-Tabelle"},
    "trade": {"identity_setting": "TRADE_BIDBLITZ_LOCAL_ADMIN_ID", "owner_setting": "TRADE_BIDBLITZ_OWNER_ID", "secret_setting": "TRADE_BIDBLITZ_SSO_SHARED_SECRET", "migration": "Alembic 0212_central_sso_nonces"},
    "nex": {"identity_setting": "NEX_BIDBLITZ_LOCAL_OWNER_ID", "owner_setting": "NEX_BIDBLITZ_OWNER_ID", "secret_setting": "NEX_BIDBLITZ_SSO_SHARED_SECRET", "migration": "002_central_sso.sql"},
    "stack": {"identity_setting": "STACK_BIDBLITZ_LOCAL_OWNER_ID", "owner_setting": "STACK_BIDBLITZ_OWNER_ID", "secret_setting": "STACK_BIDBLITZ_SSO_SHARED_SECRET", "migration": "050_central_sso.sql"},
    "aion": {"identity_setting": "AION_BIDBLITZ_LOCAL_ADMIN_ID", "owner_setting": "AION_BIDBLITZ_OWNER_ID", "secret_setting": "AION_BIDBLITZ_SSO_SHARED_SECRET", "migration": "MongoDB-Nonce-Collection mit Unique-/TTL-Index"},
    "verify": {"identity_setting": "BBV_BIDBLITZ_LOCAL_ADMIN_EMAIL", "owner_setting": "BBV_BIDBLITZ_OWNER_ID", "secret_setting": "BBV_BIDBLITZ_SSO_SHARED_SECRET", "migration": "Vorhandene SQLite-Nonce-Tabelle", "sandbox_only": True},
}


def _check(key, label, passed, detail):
    return {"id": key, "label": label, "state": "passed" if passed else "blocked", "detail": detail}


def project_readiness(project, *, native, adapter, config):
    """Accept only code-derived configuration, not owner-editable assertions."""
    project_id = project["id"]
    available = project["status"] in {"active", "dev"}
    checks = [_check("catalogue", "Katalogfreigabe", available,
                     "Aktiv oder Entwicklung erlaubt einen Einstieg." if available else
                     "Ausgeblendet oder Demnächst sperrt den Einstieg.")]
    if native:
        checks.append(_check("native_route", "Fester BidBlitz-Einstieg", True,
                             "Bestehende BidBlitz-Sitzung; jede Aktion prüft ihre eigenen Rechte."))
        return {"state": "native_ready" if available else "catalogue_disabled",
                "can_attempt": available, "checks": checks, "issuer_settings": [],
                "receiver_setup": None, "remote_access_verified": False,
                "summary": "In der BidBlitz-App integriert." if available else "Einstieg im Katalog gesperrt."}

    checks.append(_check("receiver", "Empfänger-Code", adapter,
                         "SSO-Adapter im Entwicklungsstand vorhanden; keine Live-Prüfung." if adapter else
                         "Noch kein geprüfter zentraler SSO-Empfänger angebunden."))
    settings = []
    if adapter:
        prefix = f"BIDBLITZ_SSO_{project_id.upper()}"
        settings = [f"{prefix}_ENABLED", f"{prefix}_SECRET", "BIDBLITZ_OWNER_ID"]
        if project_id in {"aion", "verify"}:
            settings.append(f"BIDBLITZ_{project_id.upper()}_BASE_URL")
        checks.extend([
            _check("destination", "Erlaubtes Übergabeziel", config["target_configured"],
                   "Festes oder validiertes HTTPS-Ziel; Katalog-Adressen haben keinen Einfluss." if config["target_configured"] else
                   "Vertrauenswürdige HTTPS-Origin fehlt oder ist ungültig."),
            _check("release", "Aussteller-Freischaltung", config["enabled"],
                   "Explizites Freischaltungsflag ist gesetzt." if config["enabled"] else
                   "Explizites Freischaltungsflag ist noch ausgeschaltet."),
            _check("key", "Aussteller-Schlüssel", config["secret_configured"],
                   "Schlüssel mit ausreichender Länge vorhanden; sein Wert bleibt verborgen." if config["secret_configured"] else
                   "Schlüssel fehlt oder ist zu kurz; ein ausdrücklich leerer Projektschlüssel sperrt den Legacy-Fallback."),
            _check("owner_subject", "Owner-Zuordnung beim Aussteller", config["owner_configured"],
                   "Owner-Subject ist gesetzt; Übereinstimmung mit dem Empfänger noch prüfen." if config["owner_configured"] else
                   "Owner-Subject ist leer; keine Zugangscodes möglich."),
        ])
        if config["secret_source"] == "legacy" and config["secret_configured"]:
            checks.append({"id": "project_key", "label": "Eigener Projektschlüssel",
                           "state": "pending", "detail": "Legacy-Fallback aktiv. Für getrennte Projekte einen eigenen Schlüssel konfigurieren."})

    required_role = REMOTE_REQUIRED_ROLES.get(project_id)
    checks.extend([
        {"id": "local_account", "label": "Lokales Admin-Konto", "state": "pending",
         "detail": f"Bestehendes aktives Konto mit Rolle {required_role} im Zielprojekt prüfen." if required_role else
                   "Lokalen Rollenvertrag und bestehendes aktives Admin-Konto im Zielprojekt prüfen."},
        {"id": "receiver_deployment", "label": "Empfänger-Bereitstellung", "state": "pending",
         "detail": "Tatsächliche Zielversion, Nonce-Speicher und passende Konfiguration noch nicht live bestätigt."},
        {"id": "receiver_login", "label": "Anmeldung, Rechte und 2FA", "state": "pending",
         "detail": "Erfolgreichen Ziel-Login, Rollenentzug, Einmal-Code und vorhandene zweite Faktoren prüfen. Keine automatische Rechtevergabe."},
    ])
    can_attempt = bool(adapter and available and config["configured"])
    state = ("not_integrated" if not adapter else "catalogue_disabled" if not available else
             "issuer_ready" if can_attempt else "issuer_incomplete")
    summaries = {
        "not_integrated": "Empfänger-Anbindung fehlt.",
        "catalogue_disabled": "Einstieg im Katalog gesperrt.",
        "issuer_ready": "Aussteller konfiguriert; Zielzugriff bleibt unbestätigt.",
        "issuer_incomplete": "Aussteller-Konfiguration ist noch unvollständig.",
    }
    return {"state": state, "can_attempt": can_attempt, "checks": checks,
            "issuer_settings": settings, "receiver_setup": RECEIVER_SETUP.get(project_id),
            "remote_access_verified": False, "summary": summaries[state]}
