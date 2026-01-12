from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'bidblitz_secret')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Stripe Config
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')

# Create the main app
app = FastAPI(title="BidBlitz Auction API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    source: Optional[str] = None  # Where user came from (google, facebook, direct, etc.)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    bids_balance: int
    is_admin: bool
    created_at: str

class ProductCreate(BaseModel):
    name: str
    description: str
    image_url: str
    retail_price: float
    category: str

class ProductResponse(BaseModel):
    id: str
    name: str
    description: str
    image_url: str
    retail_price: float
    category: str
    created_at: str

class AuctionCreate(BaseModel):
    product_id: str
    starting_price: float
    bid_increment: float
    duration_seconds: int

class AuctionResponse(BaseModel):
    id: str
    product_id: str
    product: Optional[Dict[str, Any]] = None
    current_price: float
    bid_increment: float
    end_time: str
    status: str
    winner_id: Optional[str] = None
    winner_name: Optional[str] = None
    total_bids: int
    last_bidder_id: Optional[str] = None
    last_bidder_name: Optional[str] = None
    created_at: str

class BidRequest(BaseModel):
    auction_id: str

class BidPackage(BaseModel):
    id: str
    name: str
    bids: int
    price: float
    popular: bool = False

class CheckoutRequest(BaseModel):
    package_id: str
    origin_url: str

# Fixed bid packages (server-side only)
BID_PACKAGES = {
    "starter": BidPackage(id="starter", name="Starter Pack", bids=50, price=30.00),
    "popular": BidPackage(id="popular", name="Popular Pack", bids=150, price=75.00, popular=True),
    "pro": BidPackage(id="pro", name="Pro Pack", bids=300, price=135.00),
    "elite": BidPackage(id="elite", name="Elite Pack", bids=500, price=200.00),
}

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, is_admin: bool = False) -> str:
    payload = {
        "user_id": user_id,
        "is_admin": is_admin,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(user: dict = Depends(get_current_user)):
    if not user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register", response_model=dict)
async def register(user_data: UserCreate, request: Request):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Get user's IP and referrer for tracking
    client_ip = request.client.host if request.client else "unknown"
    referrer = request.headers.get("referer", "direct")
    user_agent = request.headers.get("user-agent", "unknown")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "name": user_data.name,
        "bids_balance": 10,  # Free starting bids
        "is_admin": False,
        "is_blocked": False,  # New field for blocking users
        "created_at": datetime.now(timezone.utc).isoformat(),
        "won_auctions": [],
        "total_bids_placed": 0,
        "total_deposits": 0.0,  # Track total money deposited
        "source": user_data.source or "direct",  # Registration source
        "ip_address": client_ip,
        "referrer": referrer,
        "user_agent": user_agent,
        "country": "Unknown"  # Can be filled by IP geolocation
    }
    await db.users.insert_one(user)
    
    token = create_token(user_id)
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": user["email"],
            "name": user["name"],
            "bids_balance": user["bids_balance"],
            "is_admin": user["is_admin"]
        }
    }

@api_router.post("/auth/login", response_model=dict)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if user is blocked
    if user.get("is_blocked", False):
        raise HTTPException(status_code=403, detail="Your account has been blocked. Please contact support.")
    
    token = create_token(user["id"], user.get("is_admin", False))
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "bids_balance": user["bids_balance"],
            "is_admin": user.get("is_admin", False)
        }
    }

@api_router.get("/auth/me", response_model=dict)
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "bids_balance": user["bids_balance"],
        "is_admin": user.get("is_admin", False),
        "won_auctions": user.get("won_auctions", []),
        "total_bids_placed": user.get("total_bids_placed", 0)
    }

# ==================== PRODUCT ENDPOINTS ====================

@api_router.post("/admin/products", response_model=ProductResponse)
async def create_product(product: ProductCreate, admin: dict = Depends(get_admin_user)):
    product_id = str(uuid.uuid4())
    doc = {
        "id": product_id,
        **product.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.products.insert_one(doc)
    return ProductResponse(**doc)

@api_router.get("/products", response_model=List[ProductResponse])
async def get_products():
    products = await db.products.find({}, {"_id": 0}).to_list(100)
    return [ProductResponse(**p) for p in products]

@api_router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return ProductResponse(**product)

@api_router.delete("/admin/products/{product_id}")
async def delete_product(product_id: str, admin: dict = Depends(get_admin_user)):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

# ==================== AUCTION ENDPOINTS ====================

@api_router.post("/admin/auctions", response_model=AuctionResponse)
async def create_auction(auction: AuctionCreate, admin: dict = Depends(get_admin_user)):
    product = await db.products.find_one({"id": auction.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    auction_id = str(uuid.uuid4())
    end_time = datetime.now(timezone.utc) + timedelta(seconds=auction.duration_seconds)
    
    doc = {
        "id": auction_id,
        "product_id": auction.product_id,
        "current_price": auction.starting_price,
        "bid_increment": auction.bid_increment,
        "end_time": end_time.isoformat(),
        "status": "active",
        "winner_id": None,
        "winner_name": None,
        "total_bids": 0,
        "last_bidder_id": None,
        "last_bidder_name": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "bid_history": []
    }
    await db.auctions.insert_one(doc)
    
    return AuctionResponse(**doc, product=product)

@api_router.get("/auctions", response_model=List[AuctionResponse])
async def get_auctions(status: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    
    auctions = await db.auctions.find(query, {"_id": 0, "bid_history": 0}).sort("created_at", -1).to_list(100)
    
    # Enrich with product data
    result = []
    for auction in auctions:
        product = await db.products.find_one({"id": auction["product_id"]}, {"_id": 0})
        result.append(AuctionResponse(**auction, product=product))
    
    return result

@api_router.get("/auctions/{auction_id}", response_model=AuctionResponse)
async def get_auction(auction_id: str):
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0, "bid_history": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    product = await db.products.find_one({"id": auction["product_id"]}, {"_id": 0})
    return AuctionResponse(**auction, product=product)

@api_router.post("/auctions/{auction_id}/bid")
async def place_bid(auction_id: str, user: dict = Depends(get_current_user)):
    # Get auction
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction is not active")
    
    # Check if auction has ended
    end_time = datetime.fromisoformat(auction["end_time"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > end_time:
        raise HTTPException(status_code=400, detail="Auction has ended")
    
    # Check user's bid balance
    if user["bids_balance"] < 1:
        raise HTTPException(status_code=400, detail="Insufficient bids. Please buy more bids.")
    
    # Deduct bid from user
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"bids_balance": -1, "total_bids_placed": 1}}
    )
    
    # Update auction
    new_price = auction["current_price"] + auction["bid_increment"]
    new_end_time = datetime.now(timezone.utc) + timedelta(seconds=15)  # Reset timer on bid
    
    await db.auctions.update_one(
        {"id": auction_id},
        {
            "$set": {
                "current_price": new_price,
                "end_time": new_end_time.isoformat(),
                "last_bidder_id": user["id"],
                "last_bidder_name": user["name"]
            },
            "$inc": {"total_bids": 1},
            "$push": {
                "bid_history": {
                    "user_id": user["id"],
                    "user_name": user["name"],
                    "price": new_price,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }
        }
    )
    
    return {
        "message": "Bid placed successfully",
        "new_price": new_price,
        "new_end_time": new_end_time.isoformat(),
        "bids_remaining": user["bids_balance"] - 1
    }

@api_router.post("/admin/auctions/{auction_id}/end")
async def end_auction(auction_id: str, admin: dict = Depends(get_admin_user)):
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    winner_id = auction.get("last_bidder_id")
    winner_name = auction.get("last_bidder_name")
    
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {
            "status": "ended",
            "winner_id": winner_id,
            "winner_name": winner_name
        }}
    )
    
    # Add to winner's won auctions
    if winner_id:
        await db.users.update_one(
            {"id": winner_id},
            {"$push": {"won_auctions": auction_id}}
        )
    
    return {"message": "Auction ended", "winner_id": winner_id, "winner_name": winner_name}

@api_router.delete("/admin/auctions/{auction_id}")
async def delete_auction(auction_id: str, admin: dict = Depends(get_admin_user)):
    result = await db.auctions.delete_one({"id": auction_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Auction not found")
    return {"message": "Auction deleted"}

# ==================== BID PACKAGES & PAYMENT ====================

@api_router.get("/bid-packages")
async def get_bid_packages():
    return list(BID_PACKAGES.values())

@api_router.post("/checkout/create-session")
async def create_checkout_session(request: CheckoutRequest, http_request: Request, user: dict = Depends(get_current_user)):
    if request.package_id not in BID_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    package = BID_PACKAGES[request.package_id]
    
    # Initialize Stripe
    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Build URLs from frontend origin
    success_url = f"{request.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{request.origin_url}/buy-bids"
    
    # Create checkout session
    checkout_request = CheckoutSessionRequest(
        amount=package.price,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user["id"],
            "package_id": package.id,
            "bids": str(package.bids)
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Store transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": user["id"],
        "package_id": package.id,
        "amount": package.price,
        "currency": "usd",
        "bids": package.bids,
        "status": "pending",
        "payment_status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payment_transactions.insert_one(transaction)
    
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, http_request: Request, user: dict = Depends(get_current_user)):
    # Check if already processed
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction["payment_status"] == "paid":
        return {"status": "complete", "payment_status": "paid", "message": "Payment already processed"}
    
    # Initialize Stripe and check status
    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
    if status.payment_status == "paid" and transaction["payment_status"] != "paid":
        # Update transaction
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": "complete", "payment_status": "paid"}}
        )
        
        # Add bids to user AND update total deposits
        await db.users.update_one(
            {"id": transaction["user_id"]},
            {
                "$inc": {
                    "bids_balance": transaction["bids"],
                    "total_deposits": transaction["amount"]
                }
            }
        )
        
        return {"status": "complete", "payment_status": "paid", "bids_added": transaction["bids"]}
    
    return {
        "status": status.status,
        "payment_status": status.payment_status
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    try:
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            session_id = webhook_response.session_id
            transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
            
            if transaction and transaction["payment_status"] != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {"status": "complete", "payment_status": "paid"}}
                )
                await db.users.update_one(
                    {"id": transaction["user_id"]},
                    {
                        "$inc": {
                            "bids_balance": transaction["bids"],
                            "total_deposits": transaction["amount"]
                        }
                    }
                )
        
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error"}

# ==================== ADMIN ENDPOINTS ====================

@api_router.get("/admin/users", response_model=List[dict])
async def get_all_users(admin: dict = Depends(get_admin_user)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    
    # Add deposit totals from payment_transactions for each user
    for user in users:
        # Get total deposits from paid transactions
        pipeline = [
            {"$match": {"user_id": user["id"], "payment_status": "paid"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        result = await db.payment_transactions.aggregate(pipeline).to_list(1)
        user["total_deposits"] = result[0]["total"] if result else user.get("total_deposits", 0)
    
    return users

@api_router.put("/admin/users/{user_id}/toggle-admin")
async def toggle_admin(user_id: str, admin: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_status = not user.get("is_admin", False)
    await db.users.update_one({"id": user_id}, {"$set": {"is_admin": new_status}})
    return {"message": f"Admin status set to {new_status}"}

@api_router.put("/admin/users/{user_id}/toggle-block")
async def toggle_block_user(user_id: str, admin: dict = Depends(get_admin_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent blocking yourself
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    
    new_status = not user.get("is_blocked", False)
    await db.users.update_one({"id": user_id}, {"$set": {"is_blocked": new_status}})
    return {"message": f"User blocked status set to {new_status}", "is_blocked": new_status}

@api_router.put("/admin/users/{user_id}/add-bids")
async def add_bids_to_user(user_id: str, bids: int, admin: dict = Depends(get_admin_user)):
    result = await db.users.update_one({"id": user_id}, {"$inc": {"bids_balance": bids}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"Added {bids} bids to user"}

@api_router.get("/admin/stats")
async def get_admin_stats(admin: dict = Depends(get_admin_user)):
    total_users = await db.users.count_documents({})
    total_auctions = await db.auctions.count_documents({})
    active_auctions = await db.auctions.count_documents({"status": "active"})
    total_products = await db.products.count_documents({})
    total_transactions = await db.payment_transactions.count_documents({"payment_status": "paid"})
    
    return {
        "total_users": total_users,
        "total_auctions": total_auctions,
        "active_auctions": active_auctions,
        "total_products": total_products,
        "completed_transactions": total_transactions
    }

# ==================== SEED DATA ====================

@api_router.post("/admin/seed")
async def seed_data(admin: dict = Depends(get_admin_user)):
    # Seed products
    products = [
        {
            "id": str(uuid.uuid4()),
            "name": "MacBook Pro 16\"",
            "description": "Apple MacBook Pro with M3 Max chip, 36GB RAM, 1TB SSD",
            "image_url": "https://images.unsplash.com/photo-1537183673931-f890242dbaef?crop=entropy&cs=srgb&fm=jpg&q=85",
            "retail_price": 3499.00,
            "category": "Electronics",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Apple Watch Ultra 2",
            "description": "49mm Titanium Case with Ocean Band",
            "image_url": "https://images.unsplash.com/photo-1687040481503-3595ef7b5672?crop=entropy&cs=srgb&fm=jpg&q=85",
            "retail_price": 799.00,
            "category": "Wearables",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Sony WH-1000XM5",
            "description": "Premium Noise Cancelling Wireless Headphones",
            "image_url": "https://images.unsplash.com/photo-1636489938695-7d25c7b23ba6?crop=entropy&cs=srgb&fm=jpg&q=85",
            "retail_price": 399.00,
            "category": "Audio",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": str(uuid.uuid4()),
            "name": "PlayStation 5 Pro",
            "description": "Next-gen gaming console with 2TB storage",
            "image_url": "https://images.unsplash.com/photo-1681830723200-46731387dfbf?crop=entropy&cs=srgb&fm=jpg&q=85",
            "retail_price": 699.00,
            "category": "Gaming",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    
    for product in products:
        existing = await db.products.find_one({"name": product["name"]})
        if not existing:
            await db.products.insert_one(product)
    
    return {"message": "Seed data created", "products_added": len(products)}

# Root endpoint
@api_router.get("/")
async def root():
    return {"message": "BidBlitz Auction API", "version": "1.0.0"}

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
