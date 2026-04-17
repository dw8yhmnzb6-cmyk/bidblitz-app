"""
BidBlitz V2 - Legal Pages (AGB, Datenschutz, Impressum, Sicherheit)
Static content served via API for easy updates.
"""
from fastapi import APIRouter

router = APIRouter(prefix="/api/legal", tags=["legal"])


@router.get("/agb")
async def get_agb():
    return {"title": "Allgemeine Geschaeftsbedingungen", "slug": "agb", "content": AGB_CONTENT, "last_updated": "2026-04-17"}

@router.get("/datenschutz")
async def get_datenschutz():
    return {"title": "Datenschutzerklaerung", "slug": "datenschutz", "content": DATENSCHUTZ_CONTENT, "last_updated": "2026-04-17"}

@router.get("/impressum")
async def get_impressum():
    return {"title": "Impressum", "slug": "impressum", "content": IMPRESSUM_CONTENT, "last_updated": "2026-04-17"}

@router.get("/sicherheit")
async def get_sicherheit():
    return {"title": "Sicherheit", "slug": "sicherheit", "content": SICHERHEIT_CONTENT, "last_updated": "2026-04-17"}


AGB_CONTENT = [
    {"heading": "1. Geltungsbereich", "text": "Diese Allgemeinen Geschaeftsbedingungen (AGB) gelten fuer alle Nutzer der BidBlitz-Plattform (nachfolgend \"Plattform\"), betrieben von der BidBlitz GmbH. Mit der Registrierung und Nutzung der Plattform erklaert sich der Nutzer mit diesen AGB einverstanden."},
    {"heading": "2. Leistungsbeschreibung", "text": "BidBlitz ist eine digitale Plattform, die folgende Dienste anbietet:\n- Digitales Wallet fuer Zahlungen und Ueberweisungen\n- Kryptowaehrungs-Handel und Mining\n- Marketplace fuer digitale Produkte\n- BlitzBoost (Social Media Marketing Services)\n- BlitzTransfer (Datei-Sharing)\n- Taxi- und Mobilitaetsdienste\n- Kids-App mit Elternkontrolle\n- Haendler-Portal fuer Unternehmen\n- Weitere Dienste gemaess aktuellem Angebot"},
    {"heading": "3. Registrierung und Konto", "text": "3.1 Fuer die Nutzung der Plattform ist eine Registrierung mit gueltiger E-Mail-Adresse erforderlich.\n3.2 Der Nutzer ist verpflichtet, wahrheitsgemaesse Angaben zu machen.\n3.3 Jede Person darf nur ein Konto fuehren.\n3.4 Der Nutzer ist fuer die Geheimhaltung seiner Zugangsdaten verantwortlich.\n3.5 Bei Verdacht auf Missbrauch ist BidBlitz berechtigt, Konten zu sperren."},
    {"heading": "4. Wallet und Zahlungen", "text": "4.1 Das BidBlitz-Wallet dient zur Abwicklung von Zahlungen innerhalb der Plattform.\n4.2 Aufladungen erfolgen ueber die angebotenen Zahlungsmethoden (Kreditkarte, SEPA, Krypto).\n4.3 Guthaben ist nicht verzinst und stellt kein E-Geld im Sinne des ZAG dar.\n4.4 Auszahlungen werden innerhalb von 1-3 Werktagen bearbeitet.\n4.5 BidBlitz erhebt Transaktionsgebuehren gemaess der aktuellen Gebuehrenordnung."},
    {"heading": "5. Kryptowährungen", "text": "5.1 Der Handel mit Kryptowaehrungen ist mit erheblichen Risiken verbunden.\n5.2 BidBlitz uebernimmt keine Haftung fuer Wertverluste.\n5.3 Mining-Ertraege sind Schaetzungen und koennen variieren.\n5.4 Der Nutzer ist selbst fuer die steuerliche Behandlung seiner Krypto-Transaktionen verantwortlich."},
    {"heading": "6. BlitzBoost (Social Media Services)", "text": "6.1 BlitzBoost vermittelt Social-Media-Marketing-Dienstleistungen.\n6.2 Lieferzeiten sind Schaetzungen und koennen variieren.\n6.3 BidBlitz garantiert keine bestimmten Ergebnisse hinsichtlich Reichweite oder Engagement.\n6.4 Der Nutzer ist dafuer verantwortlich, dass die gebuchten Services den Nutzungsbedingungen der jeweiligen Plattform entsprechen.\n6.5 Rueckerstattungen bei teilweiser Lieferung erfolgen anteilig."},
    {"heading": "7. BlitzTransfer", "text": "7.1 BlitzTransfer ermoeglicht das Teilen von Dateien bis 10 GB.\n7.2 Der Nutzer ist fuer die hochgeladenen Inhalte verantwortlich.\n7.3 Das Hochladen illegaler, urheberrechtlich geschuetzter oder schaedlicher Inhalte ist verboten.\n7.4 BidBlitz behaelt sich das Recht vor, Inhalte ohne Vorankuendigung zu loeschen.\n7.5 Dateien werden nach Ablauf der Gueltigkeitsdauer automatisch geloescht."},
    {"heading": "8. Kids-App", "text": "8.1 Die Kids-App richtet sich an Kinder unter Aufsicht der Eltern/Erziehungsberechtigten.\n8.2 Eltern sind fuer die Nutzung durch ihre Kinder verantwortlich.\n8.3 Die Kids-App erfordert ein aktives Abonnement.\n8.4 GPS-Tracking-Daten werden ausschliesslich den Erziehungsberechtigten angezeigt."},
    {"heading": "9. Haendler-Portal", "text": "9.1 Haendler erhalten eine eindeutige Haendler-ID.\n9.2 BidBlitz erhebt eine Provision auf ueber die Plattform abgewickelte Transaktionen.\n9.3 Haendler sind fuer die Richtigkeit ihrer Angebote verantwortlich.\n9.4 BidBlitz kann Haendlerkonten bei Verstoessen sperren."},
    {"heading": "10. Haftung", "text": "10.1 BidBlitz haftet nur fuer Schaeden aus vorsaetzlichem oder grob fahrlaessigem Handeln.\n10.2 Die Haftung fuer leichte Fahrlaessigkeit ist ausgeschlossen, soweit gesetzlich zulaessig.\n10.3 BidBlitz haftet nicht fuer Ausfaelle, Datenverlust oder Schaeden durch Dritte."},
    {"heading": "11. Kuendigung", "text": "11.1 Der Nutzer kann sein Konto jederzeit kuendigen.\n11.2 Verbleibendes Guthaben wird innerhalb von 30 Tagen erstattet.\n11.3 BidBlitz kann Konten bei schweren Verstoessen fristlos kuendigen.\n11.4 Gesperrte Konten verlieren den Anspruch auf Auszahlung bei nachgewiesenem Betrug."},
    {"heading": "12. Aenderungen der AGB", "text": "12.1 BidBlitz behaelt sich das Recht vor, diese AGB jederzeit zu aendern.\n12.2 Aenderungen werden per E-Mail und In-App-Benachrichtigung mitgeteilt.\n12.3 Die weitere Nutzung nach Aenderung gilt als Zustimmung."},
    {"heading": "13. Schlussbestimmungen", "text": "13.1 Es gilt das Recht der Bundesrepublik Deutschland.\n13.2 Gerichtsstand ist der Sitz der BidBlitz GmbH.\n13.3 Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der uebrigen Bestimmungen unberuehrt."},
]

DATENSCHUTZ_CONTENT = [
    {"heading": "1. Verantwortlicher", "text": "Verantwortlich fuer die Datenverarbeitung ist die BidBlitz GmbH (Kontaktdaten siehe Impressum). Bei Fragen zum Datenschutz erreichen Sie unseren Datenschutzbeauftragten unter datenschutz@bidblitz.ae."},
    {"heading": "2. Erhobene Daten", "text": "Wir erheben folgende personenbezogene Daten:\n- Registrierungsdaten: Name, E-Mail-Adresse, Telefonnummer\n- Zahlungsdaten: Kreditkartendaten (verschluesselt via Stripe), IBAN fuer SEPA\n- Nutzungsdaten: IP-Adresse, Geraeteinformationen, Zugriffszeiten\n- Transaktionsdaten: Zahlungshistorie, Wallet-Bewegungen\n- Standortdaten: Nur bei aktiver Nutzung von Taxi/Scooter/Kids-GPS (mit Einwilligung)\n- Kommunikationsdaten: Nachrichten innerhalb der Plattform"},
    {"heading": "3. Zweck der Datenverarbeitung", "text": "Die Verarbeitung erfolgt zu folgenden Zwecken:\n- Bereitstellung und Verbesserung der Plattform-Dienste (Art. 6 Abs. 1 lit. b DSGVO)\n- Zahlungsabwicklung und Betrugsverhinderung (Art. 6 Abs. 1 lit. b, f DSGVO)\n- Gesetzliche Pflichten (KYC, Geldwaeschegesetz) (Art. 6 Abs. 1 lit. c DSGVO)\n- Kommunikation und Kundenservice (Art. 6 Abs. 1 lit. f DSGVO)\n- Marketing mit Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)"},
    {"heading": "4. Datenweitergabe", "text": "Ihre Daten werden an folgende Dritte weitergegeben:\n- Stripe Inc. (Zahlungsabwicklung, USA — EU-US Data Privacy Framework)\n- MongoDB Atlas (Datenbank-Hosting, EU-Region)\n- IONOS (Server-Hosting, Deutschland)\n- Cloudflare (CDN und DDoS-Schutz)\n\nEine Weitergabe an sonstige Dritte erfolgt nur mit Ihrer ausdruecklichen Einwilligung oder bei gesetzlicher Verpflichtung."},
    {"heading": "5. Speicherdauer", "text": "Personenbezogene Daten werden geloescht, sobald der Zweck der Verarbeitung entfaellt:\n- Kontodaten: Bis zur Kontoloeschung + 10 Jahre (gesetzliche Aufbewahrungsfrist)\n- Transaktionsdaten: 10 Jahre (handels- und steuerrechtliche Pflichten)\n- Nutzungsdaten/Logs: 90 Tage\n- Marketing-Einwilligungen: Bis zum Widerruf\n- BlitzTransfer-Dateien: Automatische Loeschung nach Ablaufdatum"},
    {"heading": "6. Ihre Rechte", "text": "Sie haben folgende Rechte gemaess DSGVO:\n- Auskunftsrecht (Art. 15 DSGVO)\n- Recht auf Berichtigung (Art. 16 DSGVO)\n- Recht auf Loeschung (Art. 17 DSGVO)\n- Recht auf Einschraenkung (Art. 18 DSGVO)\n- Recht auf Datenuebertragbarkeit (Art. 20 DSGVO)\n- Widerspruchsrecht (Art. 21 DSGVO)\n- Recht auf Widerruf der Einwilligung (Art. 7 Abs. 3 DSGVO)\n\nAnfragen richten Sie an datenschutz@bidblitz.ae."},
    {"heading": "7. Cookies und Tracking", "text": "Die Plattform verwendet:\n- Technisch notwendige Cookies (Session, Authentifizierung)\n- Funktionale Cookies (Sprache, Dark Mode, Modus-Auswahl)\n\nWir verwenden KEINE Tracking-Cookies oder Analytics von Drittanbietern. Alle Nutzungsdaten werden ausschliesslich auf unseren eigenen Servern verarbeitet."},
    {"heading": "8. Datensicherheit", "text": "Wir schuetzen Ihre Daten durch:\n- SSL/TLS-Verschluesselung (HSTS aktiviert)\n- Verschluesselte Passwort-Speicherung (bcrypt)\n- Zwei-Faktor-Authentifizierung (2FA)\n- Regelmaessige Sicherheits-Audits\n- Fail2Ban und Firewall-Schutz\n- Rate-Limiting gegen Brute-Force-Angriffe\n\nDetails siehe Seite \"Sicherheit\"."},
    {"heading": "9. Kinder und Datenschutz", "text": "9.1 Die Kids-App verarbeitet Daten von Kindern nur mit Einwilligung der Erziehungsberechtigten.\n9.2 GPS-Standortdaten werden nur erhoben, wenn die Eltern das Tracking aktivieren.\n9.3 Kinder-Daten werden streng getrennt von anderen Nutzerdaten gespeichert.\n9.4 Eltern koennen jederzeit die Loeschung der Kinder-Daten verlangen."},
    {"heading": "10. Beschwerderecht", "text": "Sie haben das Recht, sich bei einer Aufsichtsbehoerde zu beschweren. Zustaendige Aufsichtsbehoerde: Der Bundesbeauftragte fuer den Datenschutz und die Informationsfreiheit (BfDI)."},
]

IMPRESSUM_CONTENT = [
    {"heading": "Angaben gemaess § 5 TMG", "text": "BidBlitz GmbH\nMusterstrasse 1\n10115 Berlin\nDeutschland"},
    {"heading": "Vertreten durch", "text": "Geschaeftsfuehrer: [Name des Geschaeftsfuehrers]\nHandelsregister: Amtsgericht Berlin-Charlottenburg\nRegisternummer: HRB [Nummer]"},
    {"heading": "Kontakt", "text": "E-Mail: info@bidblitz.ae\nTelefon: +49 (0) 30 123456789\nWebsite: https://bidblitz.ae"},
    {"heading": "Umsatzsteuer-ID", "text": "Umsatzsteuer-Identifikationsnummer gemaess § 27a UStG:\nDE [Nummer]"},
    {"heading": "Aufsichtsbehoerde", "text": "BidBlitz unterliegt als Finanzdienstleister der Aufsicht durch:\n[Zustaendige Behoerde / BaFin-Registrierung falls zutreffend]"},
    {"heading": "Verantwortlich fuer den Inhalt", "text": "Verantwortlich gemaess § 55 Abs. 2 RStV:\n[Name des Verantwortlichen]\nBidBlitz GmbH\nMusterstrasse 1\n10115 Berlin"},
    {"heading": "Streitschlichtung", "text": "Die Europaeische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr\n\nWir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen."},
    {"heading": "Haftung fuer Inhalte", "text": "Als Diensteanbieter sind wir gemaess § 7 Abs. 1 TMG fuer eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, uebermittelte oder gespeicherte fremde Informationen zu ueberwachen."},
    {"heading": "Haftung fuer Links", "text": "Unser Angebot enthaelt Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Fuer die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter verantwortlich."},
    {"heading": "Urheberrecht", "text": "Die durch BidBlitz erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfaeltigung, Bearbeitung und Verbreitung ausserhalb der Grenzen des Urheberrechts beduerfen der Zustimmung von BidBlitz."},
]

SICHERHEIT_CONTENT = [
    {"heading": "Unser Sicherheitsversprechen", "text": "Bei BidBlitz hat die Sicherheit Ihrer Daten und Ihres Geldes hoechste Prioritaet. Wir setzen auf mehrschichtige Sicherheitsmassnahmen, die den hoechsten Industriestandards entsprechen."},
    {"heading": "Verschluesselung", "text": "- Alle Daten werden mit TLS 1.2/1.3 verschluesselt uebertragen (SSL/HTTPS)\n- HTTP Strict Transport Security (HSTS) ist aktiviert\n- Passwoerter werden mit bcrypt (Salted Hash) gespeichert — selbst bei einem Datenleck sind Ihre Passwoerter nicht lesbar\n- Sensible Daten (Kreditkarten) werden nie auf unseren Servern gespeichert, sondern direkt von Stripe verarbeitet (PCI DSS Level 1)"},
    {"heading": "Zwei-Faktor-Authentifizierung (2FA)", "text": "Schuetzen Sie Ihr Konto mit 2FA:\n\n1. Gehen Sie zu Einstellungen → Sicherheit\n2. Aktivieren Sie \"Zwei-Faktor-Authentifizierung\"\n3. Bei jedem Login erhalten Sie einen Einmalcode per E-Mail\n4. Ohne diesen Code ist kein Zugang moeglich — selbst wenn jemand Ihr Passwort kennt\n\nWir empfehlen dringend, 2FA fuer alle Konten zu aktivieren, insbesondere wenn Sie Kryptowährungen oder groessere Guthaben verwalten."},
    {"heading": "Brute-Force-Schutz", "text": "- Nach 3 fehlgeschlagenen Login-Versuchen wird die IP-Adresse temporaer gesperrt\n- Login-Rate-Limiting: Maximal 5 Versuche pro Minute\n- Verdaechtige Aktivitaeten werden automatisch erkannt und blockiert\n- Fail2Ban schuetzt den Server vor automatisierten Angriffen"},
    {"heading": "Server-Sicherheit", "text": "- Server-Standort: Deutschland (IONOS)\n- UFW-Firewall: Nur Ports 22, 80, 443 offen\n- API-Port (8001) ist von aussen nicht erreichbar\n- Regelmaessige Sicherheitsupdates\n- Nginx Security Headers: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection\n- Server-Version wird nicht offengelegt"},
    {"heading": "Datentrennung", "text": "- Kinder-Daten werden streng getrennt von Erwachsenen-Daten gespeichert\n- Haendler-Daten sind isoliert von Kundendaten\n- Jeder Nutzer kann nur auf seine eigenen Daten zugreifen\n- Admin-Zugriff ist durch zusaetzliche Rollenrechte geschuetzt"},
    {"heading": "Wallet-Sicherheit", "text": "- Alle Wallet-Transaktionen werden in Echtzeit protokolliert\n- Ungewoehnliche Aktivitaeten (z.B. ploetzlich hohe Ueberweisungen) loesen Warnungen aus\n- Auszahlungen erfordern Verifizierung\n- Taeglich werden automatische Backups der Transaktionsdaten erstellt"},
    {"heading": "Krypto-Sicherheit", "text": "- Krypto-Guthaben werden in sicheren Hot-Wallets verwaltet\n- Groessere Bestaende werden in Cold-Storage ueberfuehrt\n- Alle Krypto-Transaktionen sind transparent und nachvollziehbar\n- Wir empfehlen: Aktivieren Sie 2FA und verwenden Sie ein starkes, einzigartiges Passwort"},
    {"heading": "Was Sie tun koennen", "text": "Schuetzen Sie sich selbst:\n\n1. Aktivieren Sie die Zwei-Faktor-Authentifizierung\n2. Verwenden Sie ein starkes Passwort (min. 12 Zeichen, Gross-/Kleinbuchstaben, Zahlen, Sonderzeichen)\n3. Verwenden Sie nicht dasselbe Passwort wie bei anderen Diensten\n4. Loggen Sie sich nicht ueber oeffentliche WLAN-Netze ein\n5. Melden Sie verdaechtige Aktivitaeten sofort an security@bidblitz.ae"},
    {"heading": "Sicherheitsvorfall melden", "text": "Wenn Sie eine Sicherheitsluecke entdecken oder verdaechtige Aktivitaeten bemerken:\n\nE-Mail: security@bidblitz.ae\n\nWir nehmen jeden Hinweis ernst und reagieren innerhalb von 24 Stunden. Verantwortungsvolle Offenlegung (Responsible Disclosure) wird von uns geschaetzt und belohnt."},
]
