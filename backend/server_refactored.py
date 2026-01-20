"""
BidBlitz Auction Platform - Main Server
Refactored modular architecture with routers
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging
import random
import io
from datetime import datetime, timezone, timedelta

# Config and DB
from config import db, logger, BID_PACKAGES

# Import routers
from routers.auth import router as auth_router
from routers.products import router as products_router
from routers.auctions import router as auctions_router
from routers.checkout import router as checkout_router
from routers.admin import router as admin_router
from routers.affiliate import router as affiliate_router
from routers.user import router as user_router
from routers.bots import router as bots_router
from routers.vouchers import router as vouchers_router

# WebSocket manager
from services.websocket import ws_manager, broadcast_bid_update, broadcast_auction_ended

# Dependencies
from dependencies import get_current_user, get_admin_user

# PDF generation
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT

# Global flag for bot task
bot_task_running = False

# ==================== LIFESPAN ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown"""
    global bot_task_running
    
    # Startup
    bot_task_running = True
    asyncio.create_task(bot_last_second_bidder())
    logger.info("BidBlitz server started - Bot bidder task running")
    
    yield
    
    # Shutdown
    bot_task_running = False
    logger.info("BidBlitz server shutting down")

# ==================== APP CREATION ====================

app = FastAPI(
    title="BidBlitz Auction API",
    description="Penny Auction Platform",
    version="2.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== INCLUDE ROUTERS ====================

app.include_router(auth_router, prefix="/api")
app.include_router(products_router, prefix="/api")
app.include_router(auctions_router, prefix="/api")
app.include_router(checkout_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(affiliate_router, prefix="/api")
app.include_router(user_router, prefix="/api")
app.include_router(bots_router, prefix="/api")
app.include_router(vouchers_router, prefix="/api")

# ==================== HEALTH & BASIC ENDPOINTS ====================

@app.get("/")
async def root():
    return {"status": "BidBlitz API v2.0 - Refactored"}

@app.get("/api/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@app.get("/api/bid-packages")
async def get_bid_packages():
    """Get available bid packages"""
    return BID_PACKAGES

# ==================== WEBSOCKET ENDPOINTS ====================

@app.websocket("/ws/auction/{auction_id}")
async def websocket_auction(websocket: WebSocket, auction_id: str):
    """WebSocket endpoint for real-time auction updates"""
    await ws_manager.connect(websocket, auction_id)
    try:
        while True:
            # Keep connection alive, handle incoming messages
            data = await websocket.receive_text()
            # Could handle client messages here if needed
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)

@app.websocket("/ws/auctions")
async def websocket_all_auctions(websocket: WebSocket):
    """WebSocket for all auction updates"""
    await ws_manager.connect(websocket, "all_auctions")
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)

# ==================== BOT BACKGROUND TASK ====================

async def bot_last_second_bidder():
    """Background task - bots bid in last seconds until target price"""
    global bot_task_running
    
    logger.info("Bot continuous bidder started")
    last_bot_per_auction = {}
    
    while bot_task_running:
        try:
            # Get auctions with bot targets
            active_auctions = await db.auctions.find({
                "status": "active",
                "bot_target_price": {"$gt": 0}
            }, {"_id": 0}).to_list(100)
            
            for auction in active_auctions:
                try:
                    end_time = datetime.fromisoformat(auction["end_time"].replace("Z", "+00:00"))
                    now = datetime.now(timezone.utc)
                    seconds_left = (end_time - now).total_seconds()
                    
                    # Bid when 1-5 seconds left
                    if 1 <= seconds_left <= 5:
                        current_price = auction.get("current_price", 0)
                        target_price = auction.get("bot_target_price", 0)
                        auction_id = auction.get("id")
                        
                        if current_price < target_price:
                            # Get bots
                            bots = await db.bots.find({}, {"_id": 0}).to_list(100)
                            if bots:
                                # Choose different bot than last time
                                last_bot_id = last_bot_per_auction.get(auction_id)
                                available = [b for b in bots if b["id"] != last_bot_id] or bots
                                bot = random.choice(available)
                                last_bot_per_auction[auction_id] = bot["id"]
                                
                                # Place bid
                                new_price = round(current_price + auction.get("bid_increment", 0.01), 2)
                                timer_ext = random.randint(10, 20)
                                new_end_time = datetime.now(timezone.utc) + timedelta(seconds=timer_ext)
                                
                                bid_entry = {
                                    "user_id": f"bot_{bot['id']}",
                                    "user_name": bot["name"],
                                    "price": new_price,
                                    "timestamp": datetime.now(timezone.utc).isoformat(),
                                    "is_bot": True
                                }
                                
                                await db.auctions.update_one(
                                    {"id": auction_id, "status": "active"},
                                    {
                                        "$set": {
                                            "current_price": new_price,
                                            "end_time": new_end_time.isoformat(),
                                            "last_bidder_id": f"bot_{bot['id']}",
                                            "last_bidder_name": bot["name"]
                                        },
                                        "$inc": {"total_bids": 1},
                                        "$push": {"bid_history": bid_entry}
                                    }
                                )
                                
                                # Update bot stats
                                await db.bots.update_one(
                                    {"id": bot["id"]},
                                    {"$inc": {"total_bids_placed": 1}}
                                )
                                
                                # Broadcast
                                await broadcast_bid_update(auction_id, {
                                    "current_price": new_price,
                                    "last_bidder_name": bot["name"],
                                    "last_bidder_id": f"bot_{bot['id']}",
                                    "total_bids": auction.get("total_bids", 0) + 1,
                                    "end_time": new_end_time.isoformat(),
                                    "bidder_message": f"{bot['name']} hat geboten!"
                                })
                                
                                logger.info(f"Bot '{bot['name']}' bid €{new_price:.2f} on {auction_id[:8]}...")
                                
                except Exception as e:
                    logger.error(f"Bot bid error for {auction.get('id')}: {e}")
            
            await asyncio.sleep(0.5)
            
        except Exception as e:
            logger.error(f"Bot bidder error: {e}")
            await asyncio.sleep(1)
    
    logger.info("Bot bidder stopped")

# ==================== WINNERS GALLERY ====================

@app.get("/api/winners")
async def get_winners(limit: int = 20):
    """Get recent auction winners"""
    ended = await db.auctions.find(
        {"status": "ended", "winner_id": {"$ne": None}},
        {"_id": 0}
    ).sort("ended_at", -1).to_list(limit)
    
    for auction in ended:
        product = await db.products.find_one({"id": auction.get("product_id")}, {"_id": 0})
        if product:
            auction["product"] = product
    
    return ended

# ==================== BID HISTORY ====================

@app.get("/api/auctions/{auction_id}/bid-history")
async def get_bid_history(auction_id: str, limit: int = 50):
    """Get bid history for auction"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0, "bid_history": 1})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    history = auction.get("bid_history", [])
    history = sorted(history, key=lambda x: x.get("timestamp", ""), reverse=True)[:limit]
    return history

# ==================== PDF INVOICE ====================

@app.get("/api/invoice/{transaction_id}")
async def download_invoice(transaction_id: str, user: dict = Depends(get_current_user)):
    """Generate PDF invoice for a transaction"""
    transaction = await db.transactions.find_one({
        "id": transaction_id,
        "user_id": user["id"],
        "status": "completed"
    }, {"_id": 0})
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Generate PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], alignment=TA_CENTER, fontSize=24, spaceAfter=30)
    header_style = ParagraphStyle('Header', parent=styles['Normal'], fontSize=12, spaceAfter=20)
    
    elements = []
    
    # Header
    elements.append(Paragraph("BidBlitz", title_style))
    elements.append(Paragraph("Rechnung", ParagraphStyle('Subtitle', alignment=TA_CENTER, fontSize=16, spaceAfter=20)))
    elements.append(Spacer(1, 20))
    
    # Invoice details
    invoice_date = datetime.fromisoformat(transaction.get("completed_at", transaction.get("created_at")).replace("Z", "+00:00"))
    elements.append(Paragraph(f"Rechnungsnummer: INV-{transaction_id[:8].upper()}", header_style))
    elements.append(Paragraph(f"Datum: {invoice_date.strftime('%d.%m.%Y')}", header_style))
    elements.append(Paragraph(f"Kunde: {user['email']}", header_style))
    elements.append(Spacer(1, 30))
    
    # Table
    data = [
        ["Beschreibung", "Anzahl", "Preis"],
        [f"{transaction['bids']} Gebote", "1", f"€{transaction['amount']:.2f}"],
        ["", "Gesamt:", f"€{transaction['amount']:.2f}"]
    ]
    
    table = Table(data, colWidths=[10*cm, 3*cm, 3*cm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 40))
    elements.append(Paragraph("Vielen Dank für Ihren Einkauf!", ParagraphStyle('Thanks', alignment=TA_CENTER, fontSize=14)))
    
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=rechnung_{transaction_id[:8]}.pdf"}
    )

# ==================== BOT SEEDING ====================

@app.post("/api/admin/bots/seed")
async def seed_bots(admin: dict = Depends(get_admin_user)):
    """Create 20 new bots with unique names"""
    first_names = [
        "Max", "Anna", "Leon", "Sophie", "Paul", "Emma", "Luca", "Mia", "Felix", "Hannah",
        "Jonas", "Lea", "Tim", "Laura", "David", "Julia", "Simon", "Sarah", "Niklas", "Lisa",
        "Jan", "Marie", "Tom", "Lena", "Lukas", "Nele", "Ben", "Clara", "Erik", "Amelie",
        "Moritz", "Emily", "Julian", "Johanna", "Finn", "Maja", "Noah", "Alina", "Elias", "Zoe",
        "Bardh", "Arben", "Drita", "Fatmir", "Genta", "Hana", "Ilir", "Kaltrina", "Liridon", "Majlinda",
        "Stefan", "Peter", "Michael", "Thomas", "Andreas", "Matthias", "Jens", "Marco", "Sascha", "Frank"
    ]
    
    last_initials = ["K.", "M.", "S.", "L.", "H.", "B.", "W.", "R.", "F.", "T.", "N.", "P.", "G.", "D.", "J.", "A.", "E.", "V.", "Z.", "C."]
    
    import uuid
    
    created = 0
    for _ in range(20):
        for attempt in range(50):
            name = f"{random.choice(first_names)} {random.choice(last_initials)}"
            existing = await db.bots.find_one({"name": name})
            if not existing:
                bot = {
                    "id": str(uuid.uuid4()),
                    "name": name,
                    "total_bids_placed": 0,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": admin["id"]
                }
                await db.bots.insert_one(bot)
                created += 1
                break
    
    total = await db.bots.count_documents({})
    return {"message": f"{created} neue Bots erstellt", "total": total, "created": created}

# ==================== LEGACY COMPATIBILITY ====================
# These endpoints may still be used by frontend, keeping for compatibility

@app.get("/api/categories")
async def get_categories():
    """Get all product categories"""
    products = await db.products.find({}, {"category": 1}).to_list(1000)
    categories = list(set(p.get("category", "Allgemein") for p in products if p.get("category")))
    return sorted(categories)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
