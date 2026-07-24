"""
BidBlitz AI Chatbot — Knowledge Base
=====================================
Curated, versioned docs covering every major feature. Used by the RAG
retriever (routes/ai_chatbot.py) to inject domain context into the
Claude Sonnet 4.5 system prompt on every user message.

Each doc is a plain-text snippet (≤ 400 tokens) with a short `id` and a
set of `keywords` for simple keyword-based scoring (no vector DB needed).
"""
from __future__ import annotations
from typing import List, Dict


KB: List[Dict] = [
    {
        "id": "auctions-basics",
        "title": "Penny Auctions",
        "keywords": ["auktion", "auction", "bieten", "bid", "gebot", "cent", "penny", "gewinnen", "timer", "countdown"],
        "text": (
            "BidBlitz hat Penny-Auktionen: jedes Gebot kostet 0,50 € und erhöht "
            "den Preis um 0,01 €. Die verbleibende Zeit wird bei jedem Gebot um "
            "10 Sekunden verlängert. Der letzte Bieter beim Ablauf gewinnt und "
            "zahlt nur den End-Centpreis. Maximaler Listing-Preis pro Auktion: "
            "2000 €. 30 der aktiven Auktionen sind markiert als 'Nur Bot' "
            "(Entertainment) — diese kann man anschauen aber nicht bieten. "
            "Restliche Auktionen sind echte User-Auktionen."
        ),
    },
    {
        "id": "wallet",
        "title": "Wallet & Aufladen",
        "keywords": ["wallet", "guthaben", "balance", "aufladen", "topup", "top-up", "sepa", "stripe", "karte", "einzahlung"],
        "text": (
            "Die Wallet speichert dein Guthaben in EUR. Aufladen über Stripe "
            "(Kreditkarte, Apple/Google Pay) direkt in der App. Maximal 500 € "
            "pro Topup. Wallet-zu-Wallet-Transfers (BlitzTransfer) sind "
            "kostenlos und sofort. Kryptoguthaben wird separat geführt unter "
            "'Crypto Wallet' — BTC, ETH, USDC werden automatisch in EUR "
            "Gesamtbalance umgerechnet."
        ),
    },
    {
        "id": "pay-ecosystem",
        "title": "BidBlitz Pay",
        "keywords": ["pay", "zahlen", "bezahlen", "händler", "merchant", "qr", "checkout", "terminal", "pos"],
        "text": (
            "BidBlitz Pay ist das Ökosystem für Händler: QR-Checkout, "
            "SDK (pay.js) für externe Websites, Merchant-Dashboard für "
            "Auszahlungen, und ein Kassensystem (POS) mit DSFinV-K-Export, "
            "Self-Checkout, Vouchers, Tisch-QR, TSE/Fiskaly. Auszahlung an "
            "Händler erfolgt täglich via SEPA über Stripe Connect."
        ),
    },
    {
        "id": "card",
        "title": "Virtual & Physical Card",
        "keywords": ["karte", "card", "bidblitz pay card", "visa", "stripe issuing", "freeze", "pin", "virtual"],
        "text": (
            "Jeder verifizierte User (KYC Level 2+) bekommt eine virtuelle "
            "Visa-Karte. Physische Karte optional. Karte kann jederzeit in der "
            "App eingefroren / entsperrt werden ('Freeze'). Transaktionen "
            "werden live angezeigt. Tageslimits konfigurierbar. Die Karte zieht "
            "Guthaben direkt aus der Wallet — kein separates Bank­konto nötig."
        ),
    },
    {
        "id": "kyc",
        "title": "KYC Verifikation",
        "keywords": ["kyc", "verifizierung", "identität", "ausweis", "selfie", "level 1", "level 2", "level 3"],
        "text": (
            "KYC hat 4 Stufen: Level 0 (nur E-Mail), Level 1 (Name + "
            "Geburtsdatum), Level 2 (Ausweis-Upload + Liveness-Selfie — "
            "KI-geprüft via Gemini Vision), Level 3 (Adressnachweis). "
            "Limits skalieren mit Level: L0=100€ tx, L1=1000€, L2=5000€, "
            "L3=unlimitiert. KYC startet unter 'Profil → Verifizieren'. "
            "Bearbeitungszeit meist <2 Minuten dank automatischer KI-Prüfung."
        ),
    },
    {
        "id": "taxi",
        "title": "Taxi & Mobility",
        "keywords": ["taxi", "fahrt", "ride", "mobility", "scooter", "e-scooter", "fahrer", "driver"],
        "text": (
            "Taxi-Bestellung: Ziel eingeben → Preis wird angezeigt → "
            "bestätigen. Zahlung automatisch aus der Wallet oder der "
            "hinterlegten Karte. E-Scooter: QR am Scooter scannen → "
            "Fahrt starten. Fahrer-App 'BlitzDriver' separater Login mit "
            "Merchant/Driver-Rolle. Live-GPS-Tracking der Fahrt in Echtzeit."
        ),
    },
    {
        "id": "food",
        "title": "Food Delivery & Restaurants",
        "keywords": ["food", "essen", "delivery", "lieferung", "restaurant", "bestellen", "menu", "tisch", "reservierung"],
        "text": (
            "Food: Restaurants in der Umgebung, Bestellung mit Live-Tracking "
            "(Fahrer-GPS + ETA). Zahlung aus Wallet. Restaurants können am "
            "Tisch via QR bestellt werden (kontaktlos). "
            "Tischreservierung separat unter 'Restaurants reservieren'."
        ),
    },
    {
        "id": "flights-hotels",
        "title": "Flüge & Hotels",
        "keywords": ["flug", "flight", "hotel", "unterkunft", "booking", "reise", "airbnb", "skyscanner", "sabre"],
        "text": (
            "Flug-Suche: Direkt und Live über Sabre API. Airport-Autocomplete "
            "über /api/geo/airports. Hotels/Unterkünfte suchbar mit Map-View, "
            "Date-Range-Picker und Filter (Preis, Bewertung, Typ, "
            "Stornierbarkeit). Buchung zahlt direkt aus der Wallet. 3% Cashback "
            "auf alle Buchungen."
        ),
    },
    {
        "id": "kids",
        "title": "Kids-Modus",
        "keywords": ["kinder", "kids", "gps", "safe zone", "tracking", "kind", "eltern", "parental", "schulmodus"],
        "text": (
            "Kids-Modus: Eltern können ihr Kind in der App registrieren "
            "(separater Kids-Login), GPS-Tracking in Echtzeit, Safe Zones "
            "(Schule, Zuhause) mit Push bei Betreten/Verlassen, Taschengeld "
            "(Allowance), Chores, KI-Tutor, Badges. Kind sieht nur Kids-Features "
            "(kein Wallet, keine Auktionen). Komplett DSGVO-konform."
        ),
    },
    {
        "id": "referral",
        "title": "Einladungen & Referral-Provisionen",
        "keywords": ["einladen", "referral", "code", "bonus", "provision", "empfehlen", "freund", "belohnung"],
        "text": (
            "Dein persönlicher Referral-Code ist unter 'Profil → Einladen' "
            "abrufbar. Registriert sich jemand mit deinem Code, bekommst du "
            "5 € Signup-Bonus. Dazu kommt 10% Lifetime-Provision auf alle "
            "Wallet-Topups dieses Users (max. 50 € pro Einzel-Topup). "
            "Auszahlung sofort in deine Wallet. Leaderboard öffentlich unter "
            "/api/referrals/leaderboard."
        ),
    },
    {
        "id": "crypto",
        "title": "Crypto & Trading",
        "keywords": ["crypto", "btc", "bitcoin", "ethereum", "eth", "usdc", "usdt", "trading", "staking", "defi", "earn"],
        "text": (
            "Crypto-Wallet: BTC, ETH, USDC, USDT. Ein-/Auszahlungen on-chain. "
            "Trading: Spot und einfache Derivate. CryptoEarn (Staking) mit "
            "APY je Coin. Crypto-Baskets (Themen-Index-Portfolios). "
            "DeFi-Wallet mit Liquidity-Mining. Alle Kurse live von CoinGecko "
            "via /api/crypto/prices."
        ),
    },
    {
        "id": "pos-system",
        "title": "POS Kassensystem",
        "keywords": ["pos", "kasse", "kassensystem", "händler", "merchant", "produkte", "inventar", "tse", "fiskaly", "dsfinv-k", "bon"],
        "text": (
            "Das POS-System ist REWE/Aldi-Level: Checkout, Produkte, Inventar, "
            "Multi-Payment (Karte, Bar, Wallet, Voucher, BNPL, Split), "
            "TSE/Fiskaly-Signatur, Z-Bon/X-Bon/DSFinV-K-Export, "
            "Kassenmeldepflicht §146a AO, Public API (/api/pos/public/v1/*) "
            "mit X-API-Key, Self-Checkout (QR scannen), Tisch-QR, KDS, "
            "Pfand, Dynamic Pricing, Time-Clock, Tips, Offline-Modus."
        ),
    },
    {
        "id": "security",
        "title": "Sicherheit & 2FA",
        "keywords": ["sicherheit", "security", "2fa", "zwei-faktor", "passwort", "biometrie", "fido", "login"],
        "text": (
            "2FA via TOTP-App (Google Authenticator, Authy) oder per E-Mail. "
            "Biometrie (FaceID/TouchID) in der Mobile-App als zusätzlicher "
            "Login-Layer. Jede Session ist geräte-gebunden und in "
            "'Profil → Sessions' einsehbar/widerrufbar. Rate-Limiting auf "
            "allen Auth-Endpunkten (5 Fehlversuche = 15 Min Sperre). "
            "Passwort-Reset per E-Mail-Link."
        ),
    },
    {
        "id": "kassen-meldepflicht",
        "title": "Kassenmeldepflicht (Händler)",
        "keywords": ["meldung", "meldepflicht", "146a", "bsi", "tse", "elster", "finanzamt", "compliance"],
        "text": (
            "Ab 2026 müssen alle elektronischen Kassensysteme in Deutschland "
            "an das Finanzamt gemeldet sein (§146a AO). BidBlitz POS stellt "
            "unter 'POS → Compliance → Kassenmeldung' das Formular bereit, "
            "inkl. TSE-Seriennummer, BSI-Zertifikat und Inbetriebnahmedatum."
        ),
    },
    {
        "id": "support",
        "title": "Kundensupport",
        "keywords": ["support", "hilfe", "ticket", "problem", "bug", "reklamation", "erstattung"],
        "text": (
            "Support-Tickets: 'Mehr → Support'. Antwortzeit <4h Mo–Fr 9–18 "
            "Uhr. Bei dringenden Zahlungsproblemen (Kartensperre, "
            "verlorenes Guthaben) Live-Chat nutzen. Rückerstattungen laufen "
            "automatisch über die Original-Zahlungsmethode innerhalb "
            "5–10 Werktagen."
        ),
    },
    {
        "id": "marketplace-jobs",
        "title": "BlitzJobs & Freelancer",
        "keywords": ["job", "arbeit", "freelance", "blitzjobs", "fiverr", "bewerben", "anstellung"],
        "text": (
            "BlitzJobs ist ein Fiverr-Style-Marktplatz mit 6-Schritt-Wizard "
            "(Gig erstellen in <5 min). Alternativ klassisches Job-Board "
            "(JobMarketplace) für Vollzeit/Teilzeit/Mini-Jobs. City-Filter, "
            "Kategorien, Remote-Toggle, Budget-Filter. Zahlung via Escrow "
            "aus Wallet — Geld wird erst freigegeben wenn Kunde abnimmt."
        ),
    },
    {
        "id": "live-shopping",
        "title": "Live-Shopping & Live-Auctions",
        "keywords": ["live", "live-shopping", "stream", "creator", "influencer", "tiktok"],
        "text": (
            "Creators können live streamen und Produkte direkt im Stream "
            "verkaufen (TikTok-Shop Stil). Zuschauer kaufen mit einem Tap "
            "aus der Wallet. Live-Auktionen laufen in Echtzeit mit "
            "Count-up-Timer. Creator-Provision 5%, BidBlitz-Fee 3%."
        ),
    },
    {
        "id": "mining",
        "title": "BlitzMine / Mining",
        "keywords": ["mining", "blitzmine", "token", "belohnung", "level", "boost"],
        "text": (
            "BlitzMine ist ein In-App-Mining-System: täglich einloggen "
            "und 'Mine'-Button drücken → BlitzCoins verdienen. Boost "
            "erhöht Rate für 24h. BlitzCoins können in der Rewards-Shop "
            "gegen Voucher oder Guthaben eingetauscht werden."
        ),
    },
    {
        "id": "app-install",
        "title": "Mobile App (iOS/Android)",
        "keywords": ["app", "download", "install", "apk", "ios", "android", "handy", "mobile", "capacitor"],
        "text": (
            "BidBlitz gibt es als native Mobile-App für iOS und Android "
            "(gebaut mit Capacitor). Download aktuell über die Website "
            "bidblitz.ae → 'App laden'. Features wie Push, Biometrie, "
            "Kamera-Scan (QR), Offline-POS und Kartenfreeze funktionieren "
            "im Native-Container deutlich flüssiger als im Browser."
        ),
    },
]


def search(query: str, top_k: int = 3) -> List[Dict]:
    """Return top-k docs that match the query best (simple keyword scoring).

    Scoring:
      +3 per matching keyword (word boundary)
      +2 per query word appearing in title
      +1 per query word appearing in text
    """
    if not query or not query.strip():
        return []
    q = query.lower()
    tokens = [t for t in _tokenize(q) if len(t) > 2]
    if not tokens:
        return []

    scored: List[tuple] = []
    for doc in KB:
        score = 0
        kw_list = [k.lower() for k in doc.get("keywords", [])]
        title_lc = doc["title"].lower()
        text_lc = doc["text"].lower()
        for t in tokens:
            # Keyword match: exact or token starts with keyword / vice-versa
            for k in kw_list:
                if t == k or (len(k) >= 4 and (t.startswith(k) or k.startswith(t))):
                    score += 3
                    break
            if t in title_lc:
                score += 2
            if t in text_lc:
                score += 1
        if score > 0:
            scored.append((score, doc))

    scored.sort(key=lambda x: -x[0])
    return [d for _, d in scored[:top_k]]


def _tokenize(s: str) -> List[str]:
    out: List[str] = []
    cur = []
    for ch in s:
        if ch.isalnum() or ch in "äöüß":
            cur.append(ch)
        else:
            if cur:
                out.append("".join(cur))
                cur = []
    if cur:
        out.append("".join(cur))
    return out


def build_context_block(query: str, top_k: int = 3) -> str:
    """Build a system-prompt-friendly context block from top-k docs."""
    hits = search(query, top_k=top_k)
    if not hits:
        return ""
    lines = ["\n\n## Relevante BidBlitz-Fakten (aus Wissensdatenbank):"]
    for doc in hits:
        lines.append(f"\n### {doc['title']}\n{doc['text']}")
    lines.append(
        "\n\n**Nutze diese Fakten für deine Antwort, wenn sie zum Thema passen. "
        "Erfinde KEINE Features, die hier nicht stehen.**"
    )
    return "\n".join(lines)
