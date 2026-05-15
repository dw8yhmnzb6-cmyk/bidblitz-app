"""
Stripe Payment Method Tokenization für Express Checkout
Sichere Kartenspeicherung via Stripe Payment Methods API
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
import os

router = APIRouter(prefix="/api/express-checkout/stripe", tags=["Express Checkout Stripe"])

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")


class CreatePaymentMethodRequest(BaseModel):
    stripe_token: str  # Von Stripe.js im Frontend generiert
    is_default: bool = False


@router.post("/save-payment-method")
async def save_stripe_payment_method(req: CreatePaymentMethodRequest, request: Request):
    """
    Speichere Stripe Payment Method für späteren Gebrauch.
    Frontend nutzt Stripe.js um Card Token zu generieren.
    """
    from core.security import get_current_user
    from core.database import db
    from uuid import uuid4
    from datetime import datetime, timezone
    
    user = await get_current_user(request)
    
    if not STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe nicht konfiguriert")
    
    try:
        import stripe
        stripe.api_key = STRIPE_SECRET_KEY
        
        # Stripe Customer erstellen oder abrufen
        existing_customer = await db.users.find_one({"_id": user["_id"]}, {"stripe_customer_id": 1})
        
        if existing_customer and existing_customer.get("stripe_customer_id"):
            customer_id = existing_customer["stripe_customer_id"]
        else:
            # Neuen Stripe Customer erstellen
            customer = stripe.Customer.create(
                email=user.get("email"),
                metadata={"user_id": str(user["_id"])}
            )
            customer_id = customer.id
            
            # Customer ID in DB speichern
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"stripe_customer_id": customer_id}}
            )
        
        # Payment Method an Customer anhängen
        payment_method = stripe.PaymentMethod.attach(
            req.stripe_token,
            customer=customer_id,
        )
        
        # Als Default setzen falls gewünscht
        if req.is_default:
            stripe.Customer.modify(
                customer_id,
                invoice_settings={"default_payment_method": payment_method.id}
            )
            
            # Alle anderen auf non-default setzen
            await db.saved_payment_methods.update_many(
                {"user_id": str(user["_id"])},
                {"$set": {"is_default": False}}
            )
        
        # In DB speichern
        card = payment_method.card
        method_record = {
            "id": str(uuid4()),
            "user_id": str(user["_id"]),
            "stripe_payment_method_id": payment_method.id,
            "card_holder": card.get("name", ""),
            "card_number_masked": f"**** **** **** {card.last4}",
            "card_last4": card.last4,
            "card_brand": card.brand,
            "expiry": f"{card.exp_month:02d}/{card.exp_year % 100:02d}",
            "card_type": card.brand,
            "is_default": req.is_default,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "deleted": False,
        }
        
        await db.saved_payment_methods.insert_one(method_record)
        method_record.pop("_id", None)
        
        return {"ok": True, "payment_method": method_record}
    
    except ImportError:
        raise HTTPException(503, "Stripe library fehlt: pip install stripe")
    
    except Exception as e:
        raise HTTPException(500, f"Stripe Fehler: {str(e)}")


@router.post("/charge")
async def charge_with_saved_method(
    payment_method_id: str,
    amount: float,
    currency: str = "eur",
    description: Optional[str] = None,
    request: Request = None
):
    """
    Zahlung mit gespeicherter Payment Method durchführen.
    """
    from core.security import get_current_user
    from core.database import db
    
    user = await get_current_user(request)
    
    if not STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe nicht konfiguriert")
    
    try:
        import stripe
        stripe.api_key = STRIPE_SECRET_KEY
        
        # Payment Method aus DB laden
        pm = await db.saved_payment_methods.find_one({
            "id": payment_method_id,
            "user_id": str(user["_id"]),
            "deleted": {"$ne": True}
        })
        
        if not pm:
            raise HTTPException(404, "Payment Method nicht gefunden")
        
        # Stripe Customer ID
        user_record = await db.users.find_one({"_id": user["_id"]})
        customer_id = user_record.get("stripe_customer_id")
        
        if not customer_id:
            raise HTTPException(400, "Kein Stripe Customer")
        
        # Payment Intent erstellen
        intent = stripe.PaymentIntent.create(
            amount=int(amount * 100),  # Cent
            currency=currency,
            customer=customer_id,
            payment_method=pm["stripe_payment_method_id"],
            off_session=True,
            confirm=True,
            description=description or "BidBlitz Express Checkout",
        )
        
        return {
            "ok": True,
            "payment_intent_id": intent.id,
            "status": intent.status,
            "amount": amount,
            "currency": currency,
        }
    
    except ImportError:
        raise HTTPException(503, "Stripe library fehlt")
    
    except Exception as e:
        raise HTTPException(500, f"Zahlung fehlgeschlagen: {str(e)}")


@router.get("/setup-intent")
async def create_setup_intent(request: Request):
    """


@router.post("/wallet-payment")
async def wallet_payment(
    amount: float,
    currency: str = "eur",
    description: Optional[str] = None,
    payment_method_id: Optional[str] = None,
    request: Request = None
):
    """
    Apple Pay / Google Pay Zahlung verarbeiten.
    Payment Method wird direkt vom Frontend geliefert.
    """
    from core.security import get_current_user
    from core.database import db
    
    user = await get_current_user(request)
    
    if not STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe nicht konfiguriert")
    
    try:
        import stripe
        stripe.api_key = STRIPE_SECRET_KEY
        
        # Stripe Customer ID
        user_record = await db.users.find_one({"_id": user["_id"]})
        customer_id = user_record.get("stripe_customer_id")
        
        if not customer_id:
            customer = stripe.Customer.create(
                email=user.get("email"),
                metadata={"user_id": str(user["_id"])}
            )
            customer_id = customer.id
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"stripe_customer_id": customer_id}}
            )
        
        # Payment Intent erstellen
        intent = stripe.PaymentIntent.create(
            amount=int(amount * 100),
            currency=currency,
            customer=customer_id,
            payment_method=payment_method_id,
            confirm=True,
            description=description or "BidBlitz Wallet Payment",
            metadata={
                "user_id": str(user["_id"]),
                "payment_type": "wallet",
            }
        )
        
        return {
            "ok": True,
            "payment_intent_id": intent.id,
            "status": intent.status,
            "amount": amount,
            "currency": currency,
        }
    
    except ImportError:
        raise HTTPException(503, "Stripe library fehlt")
    
    except Exception as e:
        raise HTTPException(500, f"Wallet-Zahlung fehlgeschlagen: {str(e)}")

    Setup Intent für Kartenspeicherung ohne Zahlung.
    Frontend nutzt dies für Stripe Elements.
    """
    from core.security import get_current_user
    from core.database import db
    
    user = await get_current_user(request)
    
    if not STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe nicht konfiguriert")
    
    try:
        import stripe
        stripe.api_key = STRIPE_SECRET_KEY
        
        # Stripe Customer
        user_record = await db.users.find_one({"_id": user["_id"]})
        customer_id = user_record.get("stripe_customer_id")
        
        if not customer_id:
            customer = stripe.Customer.create(
                email=user.get("email"),
                metadata={"user_id": str(user["_id"])}
            )
            customer_id = customer.id
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"stripe_customer_id": customer_id}}
            )
        
        # Setup Intent
        intent = stripe.SetupIntent.create(
            customer=customer_id,
            payment_method_types=["card"],
        )
        
        return {
            "client_secret": intent.client_secret,
            "setup_intent_id": intent.id,
        }
    
    except ImportError:
        raise HTTPException(503, "Stripe library fehlt")
    
    except Exception as e:
        raise HTTPException(500, f"Setup Intent Fehler: {str(e)}")
