"""
BidBlitz V2 — Legal Pages with admin editing.

- GET /api/legal/{slug}                 → public, returns content
- GET  /api/admin/legal/all             → admin, lists all 4 documents
- GET  /api/admin/legal/{slug}          → admin, one document
- PUT  /api/admin/legal/{slug}          → admin, update content

On first request, seeds the DB from the hardcoded DEFAULTS below.
"""
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/legal", tags=["legal"])
admin_router = APIRouter(prefix="/api/admin/legal", tags=["legal-admin"])

VALID_SLUGS = ("agb", "datenschutz", "impressum", "sicherheit")

# ──────────────────────────────────────────────────────────────
# DEFAULTS (used on first seed; editable in DB afterwards)
# ──────────────────────────────────────────────────────────────
AGB_CONTENT = [
    {"heading": "1. Geltungsbereich", "text": "Diese Allgemeinen Geschaeftsbedingungen (AGB) gelten fuer alle Nutzer der BidBlitz-Plattform (nachfolgend \"Plattform\"), betrieben von BidBlitz LLC. Mit der Registrierung und Nutzung der Plattform erklaert sich der Nutzer mit diesen AGB einverstanden."},
    {"heading": "2. Leistungsbeschreibung", "text": "BidBlitz ist eine digitale Plattform, die folgende Dienste anbietet:\n- Digitales Wallet fuer Zahlungen und Ueberweisungen\n- Kryptowaehrungs-Handel und Mining\n- Marketplace fuer digitale Produkte\n- BlitzBoost (Social Media Marketing Services)\n- BlitzTransfer (Datei-Sharing)\n- Taxi- und Mobilitaetsdienste\n- Kids-App mit Elternkontrolle\n- Haendler-Portal fuer Unternehmen\n- Weitere Dienste gemaess aktuellem Angebot"},
    {"heading": "3. Registrierung und Konto", "text": "3.1 Fuer die Nutzung der Plattform ist eine Registrierung mit gueltiger E-Mail-Adresse erforderlich.\n3.2 Der Nutzer ist verpflichtet, wahrheitsgemaesse Angaben zu machen.\n3.3 Jede Person darf nur ein Konto fuehren.\n3.4 Der Nutzer ist fuer die Geheimhaltung seiner Zugangsdaten verantwortlich.\n3.5 Bei Verdacht auf Missbrauch ist BidBlitz berechtigt, Konten zu sperren."},
    {"heading": "4. Wallet und Zahlungen", "text": "4.1 Das BidBlitz-Wallet dient zur Abwicklung von Zahlungen innerhalb der Plattform.\n4.2 Aufladungen erfolgen ueber die angebotenen Zahlungsmethoden (Kreditkarte, SEPA, Krypto).\n4.3 Guthaben ist nicht verzinst und stellt kein E-Geld im Sinne des ZAG dar.\n4.4 Auszahlungen werden innerhalb von 1-3 Werktagen bearbeitet.\n4.5 BidBlitz erhebt Transaktionsgebuehren gemaess der aktuellen Gebuehrenordnung."},
    {"heading": "5. Kryptowaehrungen", "text": "5.1 Der Handel mit Kryptowaehrungen ist mit erheblichen Risiken verbunden.\n5.2 BidBlitz uebernimmt keine Haftung fuer Wertverluste.\n5.3 Mining-Ertraege sind Schaetzungen und koennen variieren.\n5.4 Der Nutzer ist selbst fuer die steuerliche Behandlung seiner Krypto-Transaktionen verantwortlich."},
    {"heading": "6. BlitzBoost (Social Media Services)", "text": "6.1 BlitzBoost vermittelt Social-Media-Marketing-Dienstleistungen.\n6.2 Lieferzeiten sind Schaetzungen und koennen variieren.\n6.3 BidBlitz garantiert keine bestimmten Ergebnisse hinsichtlich Reichweite oder Engagement.\n6.4 Der Nutzer ist dafuer verantwortlich, dass die gebuchten Services den Nutzungsbedingungen der jeweiligen Plattform entsprechen.\n6.5 Rueckerstattungen bei teilweiser Lieferung erfolgen anteilig."},
    {"heading": "7. BlitzTransfer", "text": "7.1 BlitzTransfer ermoeglicht das Teilen von Dateien bis 10 GB.\n7.2 Der Nutzer ist fuer die hochgeladenen Inhalte verantwortlich.\n7.3 Das Hochladen illegaler, urheberrechtlich geschuetzter oder schaedlicher Inhalte ist verboten.\n7.4 BidBlitz behaelt sich das Recht vor, Inhalte ohne Vorankuendigung zu loeschen.\n7.5 Dateien werden nach Ablauf der Gueltigkeitsdauer automatisch geloescht."},
    {"heading": "8. Kids-App", "text": "8.1 Die Kids-App richtet sich an Kinder unter Aufsicht der Eltern/Erziehungsberechtigten.\n8.2 Eltern sind fuer die Nutzung durch ihre Kinder verantwortlich.\n8.3 Die Kids-App erfordert ein aktives Abonnement.\n8.4 GPS-Tracking-Daten werden ausschliesslich den Erziehungsberechtigten angezeigt."},
    {"heading": "9. Haendler-Portal", "text": "9.1 Haendler erhalten eine eindeutige Haendler-ID.\n9.2 BidBlitz erhebt eine Provision auf ueber die Plattform abgewickelte Transaktionen.\n9.3 Haendler sind fuer die Richtigkeit ihrer Angebote verantwortlich.\n9.4 BidBlitz kann Haendlerkonten bei Verstoessen sperren."},
    {"heading": "10. Haftung", "text": "10.1 BidBlitz haftet nur fuer Schaeden aus vorsaetzlichem oder grob fahrlaessigem Handeln.\n10.2 Die Haftung fuer leichte Fahrlaessigkeit ist ausgeschlossen, soweit gesetzlich zulaessig.\n10.3 BidBlitz haftet nicht fuer Ausfaelle, Datenverlust oder Schaeden durch Dritte."},
    {"heading": "11. Kuendigung", "text": "11.1 Der Nutzer kann sein Konto jederzeit kuendigen.\n11.2 Verbleibendes Guthaben wird innerhalb von 30 Tagen erstattet.\n11.3 BidBlitz kann Konten bei schweren Verstoessen fristlos kuendigen.\n11.4 Gesperrte Konten verlieren den Anspruch auf Auszahlung bei nachgewiesenem Betrug."},
    {"heading": "12. Aenderungen der AGB", "text": "12.1 BidBlitz behaelt sich das Recht vor, diese AGB jederzeit zu aendern.\n12.2 Aenderungen werden per E-Mail und In-App-Benachrichtigung mitgeteilt.\n12.3 Die weitere Nutzung nach Aenderung gilt als Zustimmung."},
    {"heading": "13. Schlussbestimmungen", "text": "13.1 Es gilt das Recht der Bundesrepublik Deutschland.\n13.2 Gerichtsstand ist der Sitz der BidBlitz LLC.\n13.3 Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der uebrigen Bestimmungen unberuehrt."},
]

DATENSCHUTZ_CONTENT = [
    {"heading": "1. Verantwortlicher", "text": "Verantwortlich fuer die Datenverarbeitung ist BidBlitz LLC (Kontaktdaten siehe Impressum). Bei Fragen zum Datenschutz erreichen Sie uns unter datenschutz@bidblitz.ae."},
    {"heading": "2. Erhobene Daten", "text": "Wir erheben folgende personenbezogene Daten:\n- Registrierungsdaten: Name, E-Mail-Adresse, Telefonnummer\n- Zahlungsdaten: Kreditkartendaten (verschluesselt via Stripe), IBAN fuer SEPA\n- Nutzungsdaten: IP-Adresse, Geraeteinformationen, Zugriffszeiten\n- Transaktionsdaten: Zahlungshistorie, Wallet-Bewegungen\n- Standortdaten: Nur bei aktiver Nutzung von Taxi/Scooter/Kids-GPS (mit Einwilligung)\n- Kommunikationsdaten: Nachrichten innerhalb der Plattform"},
    {"heading": "3. Zweck der Datenverarbeitung", "text": "Die Verarbeitung erfolgt zu folgenden Zwecken:\n- Bereitstellung und Verbesserung der Plattform-Dienste\n- Zahlungsabwicklung und Betrugsverhinderung\n- Gesetzliche Pflichten (KYC, Geldwaeschegesetz)\n- Kommunikation und Kundenservice\n- Marketing mit Einwilligung"},
    {"heading": "4. Datenweitergabe", "text": "Ihre Daten werden an folgende Dritte weitergegeben:\n- Stripe Inc. (Zahlungsabwicklung, USA)\n- MongoDB Atlas (Datenbank-Hosting)\n- IONOS (Server-Hosting, Deutschland)\n- Cloudflare (CDN und DDoS-Schutz)\n\nEine Weitergabe an sonstige Dritte erfolgt nur mit Ihrer ausdruecklichen Einwilligung oder bei gesetzlicher Verpflichtung."},
    {"heading": "5. Speicherdauer", "text": "Personenbezogene Daten werden geloescht, sobald der Zweck der Verarbeitung entfaellt:\n- Kontodaten: Bis zur Kontoloeschung + 10 Jahre\n- Transaktionsdaten: 10 Jahre\n- Nutzungsdaten/Logs: 90 Tage\n- Marketing-Einwilligungen: Bis zum Widerruf\n- BlitzTransfer-Dateien: Automatische Loeschung nach Ablaufdatum"},
    {"heading": "6. Ihre Rechte", "text": "Sie haben folgende Rechte gemaess DSGVO:\n- Auskunftsrecht (Art. 15)\n- Recht auf Berichtigung (Art. 16)\n- Recht auf Loeschung (Art. 17)\n- Recht auf Einschraenkung (Art. 18)\n- Recht auf Datenuebertragbarkeit (Art. 20)\n- Widerspruchsrecht (Art. 21)\n- Recht auf Widerruf der Einwilligung (Art. 7 Abs. 3)\n\nAnfragen richten Sie an datenschutz@bidblitz.ae."},
    {"heading": "7. Cookies und Tracking", "text": "Die Plattform verwendet:\n- Technisch notwendige Cookies (Session, Authentifizierung)\n- Funktionale Cookies (Sprache, Dark Mode, Modus-Auswahl)\n\nWir verwenden KEINE Tracking-Cookies oder Analytics von Drittanbietern."},
    {"heading": "8. Datensicherheit", "text": "Wir schuetzen Ihre Daten durch:\n- SSL/TLS-Verschluesselung (HSTS aktiviert)\n- Verschluesselte Passwort-Speicherung (bcrypt)\n- Zwei-Faktor-Authentifizierung (2FA)\n- Regelmaessige Sicherheits-Audits\n- Fail2Ban und Firewall-Schutz\n- Rate-Limiting gegen Brute-Force-Angriffe"},
    {"heading": "9. Kinder und Datenschutz", "text": "9.1 Die Kids-App verarbeitet Daten von Kindern nur mit Einwilligung der Erziehungsberechtigten.\n9.2 GPS-Standortdaten werden nur erhoben, wenn die Eltern das Tracking aktivieren.\n9.3 Kinder-Daten werden streng getrennt von anderen Nutzerdaten gespeichert.\n9.4 Eltern koennen jederzeit die Loeschung der Kinder-Daten verlangen."},
    {"heading": "10. Beschwerderecht", "text": "Sie haben das Recht, sich bei einer Aufsichtsbehoerde zu beschweren."},
]

IMPRESSUM_CONTENT = [
    {"heading": "Angaben zum Betreiber", "text": "BidBlitz LLC\nBetreiber: Afrim Krasniqi\nDubai, United Arab Emirates\nFree Zone Registration pending"},
    {"heading": "Vertreten durch", "text": "Geschaeftsfuehrer: Details folgen nach Handelsregister-Eintragung"},
    {"heading": "Kontakt", "text": "E-Mail: support@bidblitz.ae\nSupport: support@bidblitz.ae\nDatenschutz: datenschutz@bidblitz.ae\nSicherheit: security@bidblitz.ae\nWebsite: https://bidblitz.ae"},
    {"heading": "Umsatzsteuer-ID", "text": "Umsatzsteuer-Identifikationsnummer: Details folgen nach Eintragung"},
    {"heading": "Aufsichtsbehoerde", "text": "BidBlitz operiert als Technologie-Plattform und unterliegt in seiner aktuellen Form keiner spezifischen Finanzaufsicht. Zahlungsabwicklungen erfolgen ueber lizenzierte Drittanbieter wie Stripe Inc."},
    {"heading": "Streitschlichtung", "text": "Die Europaeische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr\n\nWir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen."},
    {"heading": "Haftung fuer Inhalte", "text": "Als Diensteanbieter sind wir fuer eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich."},
    {"heading": "Haftung fuer Links", "text": "Unser Angebot enthaelt Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben."},
    {"heading": "Urheberrecht", "text": "Die durch BidBlitz erstellten Inhalte und Werke auf diesen Seiten unterliegen dem Urheberrecht."},
]

SICHERHEIT_CONTENT = [
    {"heading": "Unser Sicherheitsversprechen", "text": "Bei BidBlitz hat die Sicherheit Ihrer Daten und Ihres Geldes hoechste Prioritaet. Wir setzen auf mehrschichtige Sicherheitsmassnahmen, die den hoechsten Industriestandards entsprechen."},
    {"heading": "Verschluesselung", "text": "- Alle Daten werden mit TLS 1.2/1.3 verschluesselt uebertragen\n- HSTS aktiviert\n- Passwoerter werden mit bcrypt (Salted Hash) gespeichert\n- Sensible Daten (Kreditkarten) werden direkt von Stripe verarbeitet (PCI DSS Level 1)"},
    {"heading": "Zwei-Faktor-Authentifizierung (2FA)", "text": "Schuetzen Sie Ihr Konto mit 2FA:\n\n1. Gehen Sie zu Einstellungen → Sicherheit\n2. Aktivieren Sie \"Zwei-Faktor-Authentifizierung\"\n3. Bei jedem Login erhalten Sie einen Einmalcode per E-Mail\n4. Ohne diesen Code ist kein Zugang moeglich"},
    {"heading": "Brute-Force-Schutz", "text": "- Nach 3 fehlgeschlagenen Login-Versuchen wird die IP-Adresse temporaer gesperrt\n- Login-Rate-Limiting: Maximal 5 Versuche pro Minute\n- Fail2Ban schuetzt den Server vor automatisierten Angriffen"},
    {"heading": "Server-Sicherheit", "text": "- Server-Standort: Deutschland (IONOS)\n- UFW-Firewall: Nur Ports 22, 80, 443 offen\n- Regelmaessige Sicherheitsupdates\n- Nginx Security Headers"},
    {"heading": "Was Sie tun koennen", "text": "1. Aktivieren Sie die Zwei-Faktor-Authentifizierung\n2. Verwenden Sie ein starkes Passwort (min. 12 Zeichen)\n3. Verwenden Sie nicht dasselbe Passwort wie bei anderen Diensten\n4. Loggen Sie sich nicht ueber oeffentliche WLAN-Netze ein\n5. Melden Sie verdaechtige Aktivitaeten sofort an security@bidblitz.ae"},
    {"heading": "Sicherheitsvorfall melden", "text": "Wenn Sie eine Sicherheitsluecke entdecken oder verdaechtige Aktivitaeten bemerken:\n\nE-Mail: security@bidblitz.ae\n\nWir nehmen jeden Hinweis ernst und reagieren innerhalb von 24 Stunden."},
]

DEFAULTS = {
    "agb":         {"title": "Allgemeine Geschaeftsbedingungen", "content": AGB_CONTENT},
    "datenschutz": {"title": "Datenschutzerklaerung",           "content": DATENSCHUTZ_CONTENT},
    "impressum":   {"title": "Impressum",                        "content": IMPRESSUM_CONTENT},
    "sicherheit":  {"title": "Sicherheit",                       "content": SICHERHEIT_CONTENT},
}


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────
def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _normalize_impressum_content(content: list[dict]) -> tuple[list[dict], bool]:
    changed = False
    normalized = []
    for section in content or []:
        item = dict(section)
        if item.get("heading") == "Angaben zum Betreiber":
            lines = [line.strip() for line in (item.get("text") or "").split("\n") if line.strip()]
            if "Betreiber: Afrim Krasniqi" not in lines:
                if lines and lines[0] == "BidBlitz LLC":
                    lines = [lines[0], "Betreiber: Afrim Krasniqi", *lines[1:]]
                else:
                    lines.insert(0, "Betreiber: Afrim Krasniqi")
                item["text"] = "\n".join(lines)
                changed = True
        normalized.append(item)
    return normalized, changed


async def _seed_if_missing(slug: str):
    exists = await db.legal_pages.find_one({"slug": slug}, {"_id": 0, "slug": 1})
    if exists:
        return
    default = DEFAULTS.get(slug)
    if not default:
        return
    await db.legal_pages.insert_one({
        "slug": slug,
        "title": default["title"],
        "content": default["content"],
        "last_updated": _now_iso(),
    })


async def _fetch(slug: str) -> dict:
    await _seed_if_missing(slug)
    doc = await db.legal_pages.find_one({"slug": slug}, {"_id": 0})
    if doc and slug == "impressum":
        normalized_content, changed = _normalize_impressum_content(doc.get("content", []))
        if changed:
            doc["content"] = normalized_content
            doc["last_updated"] = _now_iso()
            await db.legal_pages.update_one(
                {"slug": slug},
                {"$set": {"content": normalized_content, "last_updated": doc["last_updated"]}},
            )
    return doc or {"slug": slug, "title": slug, "content": [], "last_updated": None}


async def _require_admin(request: Request):
    user = await get_current_user(request)
    role = user.get("role") or ""
    if role not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin-Rechte erforderlich.")
    return user


# ──────────────────────────────────────────────────────────────
# Public endpoints
# ──────────────────────────────────────────────────────────────
@router.get("/agb")
async def get_agb():
    return await _fetch("agb")


@router.get("/datenschutz")
async def get_datenschutz():
    return await _fetch("datenschutz")


@router.get("/impressum")
async def get_impressum():
    return await _fetch("impressum")


@router.get("/sicherheit")
async def get_sicherheit():
    return await _fetch("sicherheit")


# ──────────────────────────────────────────────────────────────
# Admin endpoints
# ──────────────────────────────────────────────────────────────
class LegalSection(BaseModel):
    heading: str
    text: str


class LegalUpdate(BaseModel):
    title: Optional[str] = None
    content: List[LegalSection] = Field(default_factory=list)


@admin_router.get("/all")
async def list_all(request: Request):
    await _require_admin(request)
    out = []
    for slug in VALID_SLUGS:
        doc = await _fetch(slug)
        out.append({
            "slug": slug,
            "title": doc.get("title"),
            "sections": len(doc.get("content", [])),
            "last_updated": doc.get("last_updated"),
        })
    return {"documents": out}


@admin_router.get("/{slug}")
async def get_one(slug: str, request: Request):
    await _require_admin(request)
    if slug not in VALID_SLUGS:
        raise HTTPException(404, "Unbekannte Legal-Seite.")
    return await _fetch(slug)


@admin_router.put("/{slug}")
async def update_one(slug: str, payload: LegalUpdate, request: Request):
    user = await _require_admin(request)
    if slug not in VALID_SLUGS:
        raise HTTPException(404, "Unbekannte Legal-Seite.")
    if not payload.content:
        raise HTTPException(400, "Mindestens ein Abschnitt erforderlich.")

    new_doc = {
        "slug": slug,
        "title": payload.title or DEFAULTS[slug]["title"],
        "content": [s.dict() for s in payload.content],
        "last_updated": _now_iso(),
        "last_updated_by": str(user.get("_id") or user.get("id")),
    }
    await db.legal_pages.update_one(
        {"slug": slug},
        {"$set": new_doc},
        upsert=True,
    )
    new_doc.pop("_id", None)
    return {"ok": True, "document": new_doc}


@admin_router.post("/{slug}/reset")
async def reset_to_default(slug: str, request: Request):
    await _require_admin(request)
    if slug not in VALID_SLUGS:
        raise HTTPException(404, "Unbekannte Legal-Seite.")
    default = DEFAULTS[slug]
    await db.legal_pages.update_one(
        {"slug": slug},
        {"$set": {
            "slug": slug,
            "title": default["title"],
            "content": default["content"],
            "last_updated": _now_iso(),
        }},
        upsert=True,
    )
    return {"ok": True, "reset": slug}
