"""Pages router - Manage editable page content"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel

from config import db, logger
from dependencies import get_admin_user

router = APIRouter(tags=["Pages"])

class PageContentUpdate(BaseModel):
    content: str
    title: Optional[str] = None

# Default content for pages - Dubai/UAE - BidBlitz FZCO - CEO: Afrim Krasniqi
DEFAULT_PAGES = {
    "impressum": {
        "title": "Impressum / Legal Notice",
        "content": """
<h2>Anbieter / Company Information</h2>
<p><strong>BidBlitz FZCO</strong><br/>
Dubai Silicon Oasis<br/>
DDP, Building A1<br/>
Dubai, Vereinigte Arabische Emirate</p>

<h3>Geschäftsführung / Management</h3>
<p><strong>Afrim Krasniqi</strong><br/>
Chief Executive Officer (CEO)</p>

<h3>Kontakt / Contact</h3>
<p>Telefon: +971 4 501 2345<br/>
E-Mail: info@bidblitz.ae</p>

<h3>Handelsregister / Trade License</h3>
<p>Dubai Silicon Oasis Authority (DSOA)<br/>
Lizenz-Nr.: DSO-FZCO-12345</p>

<h3>Umsatzsteuer-ID / VAT Registration</h3>
<p>VAT Registration Number (TRN): 100123456700003</p>

<h3>Aufsichtsbehörde / Regulatory Authority</h3>
<p>Diese Plattform unterliegt den Gesetzen der Vereinigten Arabischen Emirate und den Vorschriften des Dubai Department of Economy and Tourism (DET).</p>

<h3>Verantwortlich für den Inhalt / Responsible for Content</h3>
<p><strong>Afrim Krasniqi</strong><br/>
BidBlitz FZCO<br/>
Dubai Silicon Oasis, DDP Building A1<br/>
Dubai, VAE</p>

<h3>Streitbeilegung / Dispute Resolution</h3>
<p>Alle Streitigkeiten aus der Nutzung dieser Plattform werden nach UAE Federal Law und unter der Gerichtsbarkeit der Dubai Courts beigelegt.</p>

<p>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr" target="_blank">https://ec.europa.eu/consumers/odr</a></p>

<p><em>Diese Website wird aus Dubai, Vereinigte Arabische Emirate, betrieben.</em></p>
"""
    },
    "datenschutz": {
        "title": "Datenschutzerklärung / Privacy Policy",
        "content": """
<h2>1. Verantwortlicher / Data Controller</h2>
<p>Verantwortlich für die Datenverarbeitung auf dieser Website ist:</p>
<p><strong>BidBlitz FZCO</strong><br/>
Dubai Silicon Oasis, DDP Building A1<br/>
Dubai, Vereinigte Arabische Emirate<br/>
CEO: Afrim Krasniqi<br/>
E-Mail: datenschutz@bidblitz.ae</p>

<h2>2. Datenschutz auf einen Blick</h2>
<p>Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen.</p>

<h3>Datenerfassung auf dieser Website</h3>
<p><strong>Wer ist verantwortlich?</strong><br/>
Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber BidBlitz FZCO, vertreten durch Geschäftsführer Afrim Krasniqi.</p>

<h3>Wie erfassen wir Ihre Daten?</h3>
<ul>
<li>Daten, die Sie uns mitteilen (z.B. bei Registrierung, Bestellung)</li>
<li>Automatisch erfasste technische Daten (z.B. IP-Adresse, Browser, Betriebssystem)</li>
<li>Daten durch Cookies und Analyse-Tools</li>
</ul>

<h3>Wofür nutzen wir Ihre Daten?</h3>
<ul>
<li>Bereitstellung und Verbesserung unserer Dienste</li>
<li>Abwicklung von Käufen und Auktionen</li>
<li>Kommunikation mit Ihnen</li>
<li>Betrugsprävention und Sicherheit</li>
</ul>

<h2>3. Ihre Rechte</h2>
<p>Sie haben jederzeit das Recht auf:</p>
<ul>
<li><strong>Auskunft</strong> über Ihre gespeicherten Daten</li>
<li><strong>Berichtigung</strong> unrichtiger Daten</li>
<li><strong>Löschung</strong> Ihrer Daten</li>
<li><strong>Einschränkung</strong> der Verarbeitung</li>
<li><strong>Datenübertragbarkeit</strong></li>
<li><strong>Widerspruch</strong> gegen die Verarbeitung</li>
</ul>
<p>Zur Ausübung dieser Rechte kontaktieren Sie uns unter: datenschutz@bidblitz.ae</p>

<h2>4. Cookies</h2>
<p>Diese Website verwendet Cookies:</p>
<ul>
<li><strong>Notwendige Cookies:</strong> Für den Betrieb der Website</li>
<li><strong>Funktionale Cookies:</strong> Für bessere Nutzererfahrung</li>
<li><strong>Analyse-Cookies:</strong> Zur Verbesserung unserer Dienste</li>
</ul>

<h2>5. Zahlungsabwicklung</h2>
<p>Für die Zahlungsabwicklung nutzen wir externe Dienstleister wie Stripe. Wir speichern keine vollständigen Kreditkartendaten.</p>

<h2>6. Datensicherheit</h2>
<p>Wir verwenden SSL/TLS-Verschlüsselung für die sichere Datenübertragung. Ihre Daten werden auf geschützten Servern gespeichert.</p>

<h2>7. Internationale Datenübertragung</h2>
<p>Da unser Unternehmen in Dubai ansässig ist, können Ihre Daten in die VAE übertragen werden. Wir stellen sicher, dass angemessene Schutzmaßnahmen getroffen werden.</p>

<p><em>Stand: Januar 2026 | BidBlitz FZCO, Dubai, VAE | CEO: Afrim Krasniqi</em></p>
"""
    },
    "agb": {
        "title": "Allgemeine Geschäftsbedingungen (AGB)",
        "content": """
<h2>§ 1 Geltungsbereich</h2>
<p>Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle über die Plattform BidBlitz geschlossenen Verträge zwischen dem Anbieter und dem Kunden.</p>
<p><strong>Anbieter:</strong><br/>
BidBlitz FZCO<br/>
Dubai Silicon Oasis, DDP Building A1<br/>
Dubai, Vereinigte Arabische Emirate<br/>
CEO: Afrim Krasniqi</p>

<h2>§ 2 Vertragsgegenstand</h2>
<p>BidBlitz betreibt eine Penny-Auktion-Plattform, bei der registrierte Nutzer auf Produkte bieten können. Jedes Gebot erhöht den Preis um einen Cent (0,01 €) und verlängert die Auktionszeit.</p>

<h2>§ 3 Registrierung und Nutzerkonto</h2>
<ul>
<li>Die Nutzung der Plattform erfordert eine Registrierung.</li>
<li>Nutzer müssen mindestens 18 Jahre alt sein.</li>
<li>Die angegebenen Daten müssen wahrheitsgemäß und vollständig sein.</li>
<li>Jeder Nutzer darf nur ein Konto führen.</li>
<li>Das Passwort ist geheim zu halten.</li>
</ul>

<h2>§ 4 Gebote und Gebotspaket</h2>
<ul>
<li>Gebote werden in Paketen erworben und sind kostenpflichtig.</li>
<li>Einmal erworbene Gebote können nicht zurückgegeben oder in Geld umgewandelt werden.</li>
<li>Pro Gebotsabgabe wird ein Gebot vom Nutzerkonto abgezogen.</li>
</ul>

<h2>§ 5 Auktionsablauf</h2>
<ul>
<li>Jedes Gebot erhöht den Auktionspreis um 0,01 €.</li>
<li>Jedes Gebot setzt den Countdown zurück (8-15 Sekunden je nach Auktion).</li>
<li>Der Nutzer, dessen Gebot bei Ablauf des Countdowns aktiv ist, gewinnt.</li>
<li>Der Gewinner zahlt den finalen Auktionspreis zuzüglich Versandkosten.</li>
<li>Die "Sofort-Kaufen" Option ermöglicht den Direktkauf zum Marktpreis abzüglich verwendeter Gebote.</li>
</ul>

<h2>§ 6 Preise und Zahlung</h2>
<ul>
<li>Alle Preise verstehen sich inklusive der gesetzlichen Mehrwertsteuer (wo anwendbar).</li>
<li>Zahlungen erfolgen per Kreditkarte, PayPal oder anderen angebotenen Zahlungsmethoden.</li>
<li>Der Rechnungsbetrag ist sofort fällig.</li>
</ul>

<h2>§ 7 Lieferung</h2>
<ul>
<li>Die Lieferung erfolgt an die vom Kunden angegebene Adresse.</li>
<li>Die Lieferzeit beträgt in der Regel 5-14 Werktage.</li>
<li>Bei internationaler Lieferung können zusätzliche Zölle und Gebühren anfallen.</li>
</ul>

<h2>§ 8 Widerrufsrecht</h2>
<p>Für digitale Inhalte (Gebotspakete): Mit dem Kauf stimmen Sie zu, dass die Ausführung des Vertrags sofort beginnt und Sie auf Ihr Widerrufsrecht verzichten.</p>
<p>Für gewonnene physische Produkte gilt ein 14-tägiges Widerrufsrecht ab Erhalt der Ware.</p>

<h2>§ 9 Haftung</h2>
<p>BidBlitz haftet nur für Schäden, die auf vorsätzlichem oder grob fahrlässigem Verhalten beruhen.</p>

<h2>§ 10 Sperrung und Kündigung</h2>
<p>BidBlitz behält sich das Recht vor, Nutzerkonten bei Verstoß gegen diese AGB zu sperren oder zu löschen.</p>

<h2>§ 11 Anwendbares Recht</h2>
<p>Es gilt das Recht der Vereinigten Arabischen Emirate. Gerichtsstand ist Dubai, VAE.</p>

<h2>§ 12 Online-Streitbeilegung</h2>
<p>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung bereit: <a href="https://ec.europa.eu/consumers/odr" target="_blank">https://ec.europa.eu/consumers/odr</a></p>

<p><em>Stand: Januar 2026 | BidBlitz FZCO, Dubai, VAE | CEO: Afrim Krasniqi | E-Mail: legal@bidblitz.ae</em></p>
"""
    },
    "faq": {
        "title": "Häufig gestellte Fragen / FAQ",
        "content": ""
    },
    "contact": {
        "title": "Kontakt / Contact",
        "content": ""
    },
    "how-it-works": {
        "title": "So funktioniert's / How It Works",
        "content": ""
    }
}

@router.get("/pages")
async def get_all_pages():
    """Get all editable pages"""
    pages = await db.pages.find({}, {"_id": 0}).to_list(100)
    
    # Merge with defaults
    result = []
    for page_id, default in DEFAULT_PAGES.items():
        existing = next((p for p in pages if p.get("page_id") == page_id), None)
        if existing:
            result.append(existing)
        else:
            result.append({
                "page_id": page_id,
                "title": default["title"],
                "content": default["content"],
                "is_default": True
            })
    
    return result

@router.get("/pages/{page_id}")
async def get_page(page_id: str):
    """Get a specific page content"""
    page = await db.pages.find_one({"page_id": page_id}, {"_id": 0})
    
    if page:
        return page
    
    # Return default if exists
    if page_id in DEFAULT_PAGES:
        return {
            "page_id": page_id,
            "title": DEFAULT_PAGES[page_id]["title"],
            "content": DEFAULT_PAGES[page_id]["content"],
            "is_default": True
        }
    
    raise HTTPException(status_code=404, detail="Seite nicht gefunden")

@router.put("/admin/pages/{page_id}")
async def update_page(page_id: str, data: PageContentUpdate, admin: dict = Depends(get_admin_user)):
    """Update page content (admin only)"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if page exists
    existing = await db.pages.find_one({"page_id": page_id})
    
    update_data = {
        "page_id": page_id,
        "title": data.title or DEFAULT_PAGES.get(page_id, {}).get("title", page_id.title()),
        "content": data.content,
        "updated_at": now,
        "updated_by": admin["id"]
    }
    
    if existing:
        await db.pages.update_one(
            {"page_id": page_id},
            {"$set": update_data}
        )
    else:
        update_data["created_at"] = now
        await db.pages.insert_one(update_data)
    
    logger.info(f"Page '{page_id}' updated by admin {admin['id']}")
    
    return {
        "message": f"Seite '{data.title or page_id}' erfolgreich aktualisiert",
        "page_id": page_id
    }

@router.post("/admin/pages/{page_id}/reset")
async def reset_page(page_id: str, admin: dict = Depends(get_admin_user)):
    """Reset page to default content (admin only)"""
    if page_id not in DEFAULT_PAGES:
        raise HTTPException(status_code=404, detail="Keine Standardvorlage für diese Seite")
    
    await db.pages.delete_one({"page_id": page_id})
    
    return {
        "message": f"Seite '{page_id}' auf Standard zurückgesetzt",
        "page_id": page_id
    }
