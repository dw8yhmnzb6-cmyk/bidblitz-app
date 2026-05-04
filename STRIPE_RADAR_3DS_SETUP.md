# BidBlitz — Stripe Radar + 3D Secure 2.0 Setup

Stand: 04.05.2026 · 1-Klick-Aktivierung im Stripe Dashboard

---

## Warum aktivieren?

| Feature | Nutzen | Pflicht? | Kosten |
|---------|--------|----------|--------|
| **Stripe Radar** | Auto-Fraud-Detection (ML-basiert), erkennt 95%+ Stolen Cards | Empfohlen | 0,05€ pro Transaktion (kostenlos im Standard-Plan) |
| **3D Secure 2.0** | EU-PSD2 Strong Customer Authentication | **EU/UK PFLICHT** seit 2021 | Kostenlos |
| **Radar for Fraud Teams** | Custom Rules + Manual Review | Optional | 0,07€/txn |

→ **3DS 2.0 ist gesetzlich verpflichtend** in EU/UK (PSD2). Ohne 3DS werden EU-Karten mit `authentication_required` abgelehnt.

---

## Schritt 1: Radar aktivieren (1 Min)

1. https://dashboard.stripe.com/settings/radar öffnen (Live-Mode!)
2. Auto-aktiv im Standard-Plan ✅ (du musst nichts tun)
3. Optional: Im Tab **"Rules"** → Custom Rules anpassen, z.B.:
   - `Block if :card_country: != :ip_country: and :amount: > 100€`
   - `Review if :is_proxy: = true`

---

## Schritt 2: 3D Secure 2.0 aktivieren

### Option A: Automatisch (empfohlen)
Stripe entscheidet selbst, wann 3DS getriggert wird (basierend auf Risk-Score von Radar).
**Bereits aktiv** — keine Code-Änderung nötig wenn `payment_method_types: ["card"]`.

### Option B: Immer 3DS (höchste Sicherheit, leicht höhere Conversion-Drops)
In `/var/www/bidblitz/backend/routes/stripe.py` ergänzen bei `session_params`:
```python
"payment_intent_data": {
    "setup_future_usage": "off_session",
    "payment_method_options": {
        "card": {
            "request_three_d_secure": "any"  # "automatic" | "any" | "challenge_only"
        }
    }
},
```

Werte:
- `automatic` (default) — nur wenn Stripe Radar es vorschlägt
- `any` — JEDE Transaktion durchläuft 3DS Challenge (nur wenn Bank es unterstützt)
- `challenge_only` — bricht ab wenn Bank kein 3DS hat (max. Sicherheit)

**Empfehlung:** `automatic` lassen. EU-Karten werden auto-3DS, Non-EU-Karten nicht (bessere Conversion).

---

## Schritt 3: Webhook Events erweitern (optional, für Monitoring)

Stripe Dashboard → Webhooks → `https://bidblitz.ae/api/webhook/stripe` → Edit

Zusätzliche Events aktivieren:
- `radar.early_fraud_warning.created` — Stripe meldet wenn Karte als Fraud bekannt
- `charge.dispute.created` — Chargeback gestartet
- `charge.dispute.closed` — Chargeback abgeschlossen

→ Backend kann automatisch Wallet einfrieren / User benachrichtigen.

---

## Schritt 4: Fraud Score in DB speichern (Audit-Trail)

In `payment_transactions` Collection bereits enthalten:
- `metadata.fraud_score` (kommt von Stripe in `payment_intent.charges.data[0].outcome.risk_score`)
- `metadata.risk_level` (`normal` | `elevated` | `highest`)

Empfehlung: Nach 3 fraud_score > 75 → User-Account auto-flag → manuelle Review.

---

## Schritt 5: Compliance-Doku für UAE/EU

| Regulierung | Status | Beweis |
|-------------|--------|--------|
| **EU PSD2 SCA** | ✅ via Stripe 3DS auto | Stripe-Doku |
| **GDPR Art. 25** (Privacy by Design) | ✅ kein Karten-Storage | Stripe Vault |
| **PCI-DSS Level 1** | ✅ via Stripe | https://stripe.com/docs/security |
| **UAE Anti-Money-Laundering** | ✅ via KYC + max. 5.000€/Tag Transfer-Limit | `routes/kyc.py` |
| **AML 6th Directive** | ✅ Risk-Scoring + Sanctions-Screening | Stripe Radar Pro (Upgrade nötig) |

---

## Quick-Test: Verifiziere dass 3DS funktioniert

Stripe Test-Karte (nur Test-Mode, in Production NICHT verfügbar):
- `4000 0027 6000 3184` → triggert immer 3DS Challenge

In Live-Mode: Echte EU-Karte verwenden. Bei Zahlung sollte Browser ein 3DS-Popup zeigen ("Bestätige in deiner Banking-App / SMS").

---

## Empfohlener Production-Setup (Final)

```
✅ Radar: aktiv (default)
✅ 3DS: automatic (default)
✅ Webhook: alle checkout.* + charge.dispute.* + radar.early_fraud_warning.created
✅ Webhook Signing-Secret: gesetzt
✅ STRIPE_API_KEY: sk_live_... (rolled, fresh)
✅ Daily-Limit pro User: 5.000€ (in routes/wallet.py enforced)
✅ KYC-Pflicht für Topup > 100€ (in routes/kyc.py)
```
