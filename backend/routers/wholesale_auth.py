"""
Wholesale Authentication Router
Separate login and registration for B2B wholesale customers
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, EmailStr
import uuid
import secrets
import string

from config import db, logger
from dependencies import (
    hash_password, verify_password, validate_password_strength, 
    create_token, get_client_ip, log_security_event
)
from utils.email import send_wholesale_welcome_email

router = APIRouter(prefix="/wholesale/auth", tags=["Wholesale Auth"])

# ==================== SCHEMAS ====================

class WholesaleRegister(BaseModel):
    company_name: str
    contact_name: str
    email: EmailStr
    phone: str
    password: str
    website: Optional[str] = None
    tax_id: Optional[str] = None  # Steuernummer
    expected_volume: str  # e.g., "500-1000", "1000-5000", "5000+"
    message: Optional[str] = None

class WholesaleLogin(BaseModel):
    email: EmailStr
    password: str

class WholesaleProfileUpdate(BaseModel):
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    tax_id: Optional[str] = None


# ==================== HELPER FUNCTIONS ====================

async def get_wholesale_user(request: Request):
    """Get current wholesale user from token"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Nicht authentifiziert")
    
    token = auth_header.split(" ")[1]
    
    # Decode token
    import jwt
    from config import JWT_SECRET
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "wholesale":
            raise HTTPException(status_code=401, detail="Ungültiger Token-Typ")
        
        wholesale_id = payload.get("wholesale_id")
        customer = await db.wholesale_customers.find_one({"id": wholesale_id})
        if not customer:
            raise HTTPException(status_code=401, detail="Großkunde nicht gefunden")
        
        if customer.get("status") != "active":
            raise HTTPException(status_code=403, detail="Konto noch nicht freigeschaltet")
            
        return customer
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token abgelaufen")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Ungültiger Token")


def generate_temp_password(length=12):
    """Generate a secure temporary password"""
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(secrets.choice(alphabet) for _ in range(length))


# ==================== AUTH ENDPOINTS ====================

@router.post("/register")
async def wholesale_register(data: WholesaleRegister, request: Request):
    """Register as a wholesale customer (requires admin approval)"""
    client_ip = get_client_ip(request)
    
    # Check if email already exists
    existing = await db.wholesale_customers.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Ein Konto mit dieser E-Mail existiert bereits")
    
    existing_app = await db.wholesale_applications.find_one({"email": data.email.lower()})
    if existing_app:
        raise HTTPException(status_code=400, detail="Eine Bewerbung mit dieser E-Mail ist bereits in Bearbeitung")
    
    # Validate password
    is_valid, error_msg = validate_password_strength(data.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Create wholesale customer record (pending approval)
    wholesale_id = str(uuid.uuid4())
    hashed_pw = hash_password(data.password)
    
    customer_doc = {
        "id": wholesale_id,
        "company_name": data.company_name,
        "contact_name": data.contact_name,
        "email": data.email.lower(),
        "phone": data.phone,
        "password": hashed_pw,
        "website": data.website,
        "tax_id": data.tax_id,
        "expected_volume": data.expected_volume,
        "message": data.message,
        "status": "pending",  # pending, active, suspended
        "discount_percent": 0,
        "credit_limit": 0,
        "credit_used": 0,
        "payment_terms": "prepaid",
        "total_orders": 0,
        "total_spent": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_login": None,
        "registration_ip": client_ip
    }
    
    await db.wholesale_customers.insert_one(customer_doc)
    
    # Also create an application record for admin to review
    app_doc = {
        "id": str(uuid.uuid4()),
        "wholesale_id": wholesale_id,
        "company_name": data.company_name,
        "contact_name": data.contact_name,
        "email": data.email.lower(),
        "phone": data.phone,
        "website": data.website,
        "expected_volume": data.expected_volume,
        "message": data.message,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.wholesale_applications.insert_one(app_doc)
    
    logger.info(f"🏢 New wholesale registration: {data.company_name} ({data.email})")
    
    await log_security_event("wholesale_registration", wholesale_id, {
        "company": data.company_name,
        "email": data.email
    }, client_ip)
    
    return {
        "success": True,
        "message": "Registrierung erfolgreich! Ihr Konto wird innerhalb von 24-48 Stunden geprüft und freigeschaltet.",
        "wholesale_id": wholesale_id
    }


@router.post("/login")
async def wholesale_login(credentials: WholesaleLogin, request: Request):
    """Login for wholesale customers"""
    client_ip = get_client_ip(request)
    
    customer = await db.wholesale_customers.find_one({"email": credentials.email.lower()})
    
    if not customer:
        await log_security_event("wholesale_login_failed", "unknown", {
            "email": credentials.email,
            "reason": "not_found"
        }, client_ip)
        raise HTTPException(status_code=401, detail="E-Mail oder Passwort falsch")
    
    if not customer.get("password"):
        raise HTTPException(status_code=401, detail="Bitte setzen Sie zuerst ein Passwort")
    
    if not verify_password(credentials.password, customer["password"]):
        await log_security_event("wholesale_login_failed", customer["id"], {
            "reason": "wrong_password"
        }, client_ip)
        raise HTTPException(status_code=401, detail="E-Mail oder Passwort falsch")
    
    # Check account status
    if customer.get("status") == "pending":
        raise HTTPException(
            status_code=403, 
            detail="Ihr Konto wird noch geprüft. Sie erhalten eine E-Mail, sobald es freigeschaltet ist."
        )
    
    if customer.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Ihr Konto wurde gesperrt. Bitte kontaktieren Sie den Support.")
    
    # Create wholesale-specific token
    import jwt
    from config import JWT_SECRET
    token_payload = {
        "wholesale_id": customer["id"],
        "email": customer["email"],
        "company": customer["company_name"],
        "type": "wholesale",
        "exp": datetime.now(timezone.utc).timestamp() + (7 * 24 * 60 * 60)  # 7 days
    }
    token = jwt.encode(token_payload, JWT_SECRET, algorithm="HS256")
    
    # Update last login
    await db.wholesale_customers.update_one(
        {"id": customer["id"]},
        {"$set": {
            "last_login": datetime.now(timezone.utc).isoformat(),
            "last_login_ip": client_ip
        }}
    )
    
    await log_security_event("wholesale_login_success", customer["id"], {
        "company": customer["company_name"]
    }, client_ip)
    
    logger.info(f"🏢 Wholesale login: {customer['company_name']}")
    
    return {
        "success": True,
        "token": token,
        "customer": {
            "id": customer["id"],
            "company_name": customer["company_name"],
            "contact_name": customer["contact_name"],
            "email": customer["email"],
            "discount_percent": customer.get("discount_percent", 0),
            "credit_limit": customer.get("credit_limit", 0),
            "credit_used": customer.get("credit_used", 0),
            "payment_terms": customer.get("payment_terms", "prepaid"),
            "status": customer["status"]
        }
    }


@router.get("/me")
async def get_wholesale_profile(customer = Depends(get_wholesale_user)):
    """Get current wholesale customer profile"""
    return {
        "id": customer["id"],
        "company_name": customer["company_name"],
        "contact_name": customer["contact_name"],
        "email": customer["email"],
        "phone": customer.get("phone"),
        "website": customer.get("website"),
        "tax_id": customer.get("tax_id"),
        "discount_percent": customer.get("discount_percent", 0),
        "credit_limit": customer.get("credit_limit", 0),
        "credit_used": customer.get("credit_used", 0),
        "payment_terms": customer.get("payment_terms", "prepaid"),
        "total_orders": customer.get("total_orders", 0),
        "total_spent": customer.get("total_spent", 0),
        "status": customer["status"],
        "created_at": customer.get("created_at"),
        "last_login": customer.get("last_login")
    }


@router.put("/profile")
async def update_wholesale_profile(
    data: WholesaleProfileUpdate,
    customer = Depends(get_wholesale_user)
):
    """Update wholesale customer profile"""
    update_data = {}
    if data.contact_name:
        update_data["contact_name"] = data.contact_name
    if data.phone:
        update_data["phone"] = data.phone
    if data.website:
        update_data["website"] = data.website
    if data.tax_id:
        update_data["tax_id"] = data.tax_id
    
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.wholesale_customers.update_one(
            {"id": customer["id"]},
            {"$set": update_data}
        )
    
    return {"success": True, "message": "Profil aktualisiert"}


@router.get("/orders")
async def get_wholesale_orders(customer = Depends(get_wholesale_user)):
    """Get order history for wholesale customer"""
    orders = await db.wholesale_orders.find(
        {"wholesale_id": customer["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return {"orders": orders}


@router.get("/invoices")
async def get_wholesale_invoices(customer = Depends(get_wholesale_user)):
    """Get invoices for wholesale customer"""
    invoices = await db.wholesale_invoices.find(
        {"wholesale_id": customer["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return {"invoices": invoices}


@router.get("/pricing")
async def get_wholesale_pricing(customer = Depends(get_wholesale_user)):
    """Get special B2B pricing for wholesale customer"""
    from config import BID_PACKAGES
    
    discount = customer.get("discount_percent", 0)
    
    # Calculate discounted prices
    packages = []
    for pkg in BID_PACKAGES:
        discounted_price = pkg["price"] * (1 - discount / 100)
        packages.append({
            **pkg,
            "original_price": pkg["price"],
            "discounted_price": round(discounted_price, 2),
            "discount_percent": discount,
            "savings": round(pkg["price"] - discounted_price, 2)
        })
    
    return {
        "packages": packages,
        "discount_percent": discount,
        "credit_limit": customer.get("credit_limit", 0),
        "credit_available": customer.get("credit_limit", 0) - customer.get("credit_used", 0),
        "payment_terms": customer.get("payment_terms", "prepaid")
    }


@router.post("/order")
async def create_wholesale_order(
    package_id: str,
    quantity: int = 1,
    customer = Depends(get_wholesale_user)
):
    """Create a wholesale order for bid packages"""
    from config import BID_PACKAGES
    
    # Find package
    package = next((p for p in BID_PACKAGES if p.get("id") == package_id or str(p.get("bids")) == package_id), None)
    if not package:
        raise HTTPException(status_code=404, detail="Paket nicht gefunden")
    
    discount = customer.get("discount_percent", 0)
    unit_price = package["price"] * (1 - discount / 100)
    total_price = unit_price * quantity
    total_bids = package["bids"] * quantity
    
    # Check credit if payment terms allow it
    if customer.get("payment_terms") != "prepaid":
        credit_available = customer.get("credit_limit", 0) - customer.get("credit_used", 0)
        if total_price > credit_available:
            raise HTTPException(
                status_code=400, 
                detail=f"Kreditlimit überschritten. Verfügbar: €{credit_available:.2f}"
            )
    
    # Create order
    order_id = str(uuid.uuid4())
    order_doc = {
        "id": order_id,
        "wholesale_id": customer["id"],
        "company_name": customer["company_name"],
        "package_name": f"{package['bids']} Gebote",
        "package_bids": package["bids"],
        "quantity": quantity,
        "unit_price": round(unit_price, 2),
        "total_price": round(total_price, 2),
        "total_bids": total_bids,
        "discount_percent": discount,
        "payment_terms": customer.get("payment_terms", "prepaid"),
        "status": "pending" if customer.get("payment_terms") != "prepaid" else "awaiting_payment",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.wholesale_orders.insert_one(order_doc)
    
    # If credit terms, update credit used and deliver bids immediately
    if customer.get("payment_terms") != "prepaid":
        await db.wholesale_customers.update_one(
            {"id": customer["id"]},
            {
                "$inc": {
                    "credit_used": total_price,
                    "total_orders": 1,
                    "total_spent": total_price
                }
            }
        )
        
        # If customer has a linked user account, add bids
        if customer.get("user_id"):
            await db.users.update_one(
                {"id": customer["user_id"]},
                {"$inc": {"bids": total_bids}}
            )
            order_doc["status"] = "completed"
            await db.wholesale_orders.update_one(
                {"id": order_id},
                {"$set": {"status": "completed", "delivered_at": datetime.now(timezone.utc).isoformat()}}
            )
    
    logger.info(f"🏢 Wholesale order: {customer['company_name']} - {total_bids} bids (€{total_price:.2f})")
    
    return {
        "success": True,
        "order_id": order_id,
        "total_bids": total_bids,
        "total_price": round(total_price, 2),
        "status": order_doc["status"],
        "message": "Bestellung erfolgreich erstellt"
    }


# ==================== B2B CUSTOMER MANAGEMENT ====================

class B2BCustomerAdd(BaseModel):
    """Schema for adding a customer to B2B wholesale account"""
    customer_number: str  # 8-digit customer number
    nickname: Optional[str] = None  # Optional nickname for the customer

class B2BSendBids(BaseModel):
    """Schema for sending bids to a customer"""
    customer_number: str
    amount: int
    message: Optional[str] = None

@router.get("/my-customers")
async def get_b2b_customers(customer = Depends(get_wholesale_user)):
    """Get all customers linked to this B2B wholesale account"""
    # Get linked customers
    linked_customers = await db.b2b_customer_links.find(
        {"wholesale_id": customer["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich with user data
    enriched = []
    for link in linked_customers:
        user = await db.users.find_one(
            {"customer_number": link["customer_number"]},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "customer_number": 1, "bids_balance": 1}
        )
        if user:
            enriched.append({
                **link,
                "user_name": user.get("name", "Unbekannt"),
                "user_email": user.get("email"),
                "current_bids": user.get("bids_balance", 0)
            })
        else:
            enriched.append({
                **link,
                "user_name": "Nicht gefunden",
                "user_email": None,
                "current_bids": 0
            })
    
    return {"customers": enriched, "total": len(enriched)}


@router.post("/add-customer")
async def add_b2b_customer(data: B2BCustomerAdd, customer = Depends(get_wholesale_user)):
    """Add a customer to B2B wholesale account by customer number"""
    # Find user by customer number
    user = await db.users.find_one(
        {"customer_number": data.customer_number},
        {"_id": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="Kundennummer nicht gefunden")
    
    # Check if already linked
    existing = await db.b2b_customer_links.find_one({
        "wholesale_id": customer["id"],
        "customer_number": data.customer_number
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Dieser Kunde ist bereits verknüpft")
    
    # Create link
    link_doc = {
        "id": str(uuid.uuid4()),
        "wholesale_id": customer["id"],
        "wholesale_company": customer["company_name"],
        "user_id": user["id"],
        "customer_number": data.customer_number,
        "nickname": data.nickname,
        "total_bids_sent": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.b2b_customer_links.insert_one(link_doc)
    
    logger.info(f"🏢 B2B customer linked: {customer['company_name']} -> {user.get('name', 'Unknown')} ({data.customer_number})")
    
    return {
        "success": True,
        "message": f"Kunde {user.get('name', 'Unbekannt')} erfolgreich hinzugefügt",
        "customer": {
            "customer_number": data.customer_number,
            "user_name": user.get("name", "Unbekannt"),
            "nickname": data.nickname
        }
    }


@router.delete("/remove-customer/{customer_number}")
async def remove_b2b_customer(customer_number: str, customer = Depends(get_wholesale_user)):
    """Remove a customer from B2B wholesale account"""
    result = await db.b2b_customer_links.delete_one({
        "wholesale_id": customer["id"],
        "customer_number": customer_number
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kundenverknüpfung nicht gefunden")
    
    return {"success": True, "message": "Kunde entfernt"}


@router.post("/send-bids")
async def send_bids_to_customer(data: B2BSendBids, customer = Depends(get_wholesale_user)):
    """Send bids from B2B wholesale account to a linked customer"""
    # Validate amount
    if data.amount < 1:
        raise HTTPException(status_code=400, detail="Mindestens 1 Gebot erforderlich")
    
    if data.amount > 10000:
        raise HTTPException(status_code=400, detail="Maximal 10.000 Gebote pro Übertragung")
    
    # Check if customer is linked
    link = await db.b2b_customer_links.find_one({
        "wholesale_id": customer["id"],
        "customer_number": data.customer_number
    })
    
    if not link:
        raise HTTPException(status_code=403, detail="Dieser Kunde ist nicht mit Ihrem Konto verknüpft")
    
    # Find the recipient user
    recipient = await db.users.find_one({"customer_number": data.customer_number})
    if not recipient:
        raise HTTPException(status_code=404, detail="Empfänger nicht gefunden")
    
    # Check B2B account has enough credit/balance
    # For B2B, we use credit system - check available credit
    credit_available = customer.get("credit_limit", 0) - customer.get("credit_used", 0)
    
    # Calculate cost (simplified: 1 bid = 0.10€ for B2B)
    bid_cost = 0.10  # Can be customized based on discount
    total_cost = data.amount * bid_cost * (1 - customer.get("discount_percent", 0) / 100)
    
    if customer.get("payment_terms") != "prepaid" and total_cost > credit_available:
        raise HTTPException(
            status_code=400, 
            detail=f"Nicht genügend Kredit verfügbar. Benötigt: €{total_cost:.2f}, Verfügbar: €{credit_available:.2f}"
        )
    
    # Create transfer record
    transfer_id = str(uuid.uuid4())
    transfer_doc = {
        "id": transfer_id,
        "wholesale_id": customer["id"],
        "wholesale_company": customer["company_name"],
        "recipient_id": recipient["id"],
        "recipient_name": recipient.get("name", "Unbekannt"),
        "customer_number": data.customer_number,
        "amount": data.amount,
        "cost": round(total_cost, 2),
        "message": data.message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.b2b_bid_transfers.insert_one(transfer_doc)
    
    # Add bids to recipient
    await db.users.update_one(
        {"id": recipient["id"]},
        {"$inc": {"bids_balance": data.amount}}
    )
    
    # Update B2B credit used (if not prepaid)
    if customer.get("payment_terms") != "prepaid":
        await db.wholesale_customers.update_one(
            {"id": customer["id"]},
            {"$inc": {"credit_used": total_cost, "total_spent": total_cost}}
        )
    
    # Update link statistics
    await db.b2b_customer_links.update_one(
        {"wholesale_id": customer["id"], "customer_number": data.customer_number},
        {"$inc": {"total_bids_sent": data.amount}}
    )
    
    # Create notification for recipient
    notification_doc = {
        "id": str(uuid.uuid4()),
        "user_id": recipient["id"],
        "type": "bids_received",
        "title": "Gebote erhalten!",
        "message": f"Sie haben {data.amount} Gebote von {customer['company_name']} erhalten" + 
                   (f": \"{data.message}\"" if data.message else ""),
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    
    logger.info(f"🎁 B2B bid transfer: {customer['company_name']} -> {recipient.get('name')} ({data.amount} bids)")
    
    return {
        "success": True,
        "message": f"{data.amount} Gebote erfolgreich an {recipient.get('name', 'Unbekannt')} gesendet",
        "transfer": {
            "id": transfer_id,
            "amount": data.amount,
            "cost": round(total_cost, 2),
            "recipient": recipient.get("name", "Unbekannt")
        }
    }


@router.get("/bid-transfers")
async def get_bid_transfers(customer = Depends(get_wholesale_user)):
    """Get history of bid transfers for this B2B account"""
    transfers = await db.b2b_bid_transfers.find(
        {"wholesale_id": customer["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Calculate totals
    total_bids_sent = sum(t.get("amount", 0) for t in transfers)
    total_cost = sum(t.get("cost", 0) for t in transfers)
    
    return {
        "transfers": transfers,
        "total_transfers": len(transfers),
        "total_bids_sent": total_bids_sent,
        "total_cost": round(total_cost, 2)
    }


@router.get("/customer-stats/{customer_number}")
async def get_customer_stats(customer_number: str, customer = Depends(get_wholesale_user)):
    """Get stats for a specific linked customer"""
    # Check if customer is linked
    link = await db.b2b_customer_links.find_one({
        "wholesale_id": customer["id"],
        "customer_number": customer_number
    })
    
    if not link:
        raise HTTPException(status_code=403, detail="Dieser Kunde ist nicht mit Ihrem Konto verknüpft")
    
    # Get user data
    user = await db.users.find_one(
        {"customer_number": customer_number},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "bids_balance": 1, "total_deposits": 1, "created_at": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    # Get transfers to this customer
    transfers = await db.b2b_bid_transfers.find({
        "wholesale_id": customer["id"],
        "customer_number": customer_number
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    return {
        "customer": {
            "customer_number": customer_number,
            "name": user.get("name", "Unbekannt"),
            "email": user.get("email"),
            "current_bids": user.get("bids_balance", 0),
            "member_since": user.get("created_at"),
            "nickname": link.get("nickname")
        },
        "stats": {
            "total_bids_sent": link.get("total_bids_sent", 0),
            "linked_since": link.get("created_at"),
            "transfer_count": len(transfers)
        },
        "recent_transfers": transfers[:10]
    }

