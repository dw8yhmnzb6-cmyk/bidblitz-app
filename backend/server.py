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
from routers.staff import router as staff_router
from routers.rewards import router as rewards_router
from routers.invoices import router as invoices_router
from routers.notifications import router as notifications_router
from routers.vip import router as vip_router
from routers.pages import router as pages_router

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
    asyncio.create_task(auction_reminder_processor())
    asyncio.create_task(auction_auto_restart_processor())
    logger.info("BidBlitz server started - Bot bidder, Reminder & Auto-restart tasks running")
    
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
app.include_router(staff_router, prefix="/api")
app.include_router(rewards_router, prefix="/api")
app.include_router(invoices_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(vip_router, prefix="/api")
app.include_router(pages_router, prefix="/api")

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

@app.websocket("/api/ws/auction/{auction_id}")
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

@app.websocket("/api/ws/auctions")
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

# Also support legacy paths without /api prefix
@app.websocket("/ws/auction/{auction_id}")
async def websocket_auction_legacy(websocket: WebSocket, auction_id: str):
    await websocket_auction(websocket, auction_id)

@app.websocket("/ws/auctions")
async def websocket_all_auctions_legacy(websocket: WebSocket):
    await websocket_all_auctions(websocket)

# ==================== BOT BACKGROUND TASK ====================

async def bot_last_second_bidder():
    """Background task - bots bid in last seconds until auction price reaches bot_target_price.
    
    WICHTIG: Bots bieten NUR bis der aktuelle Preis den bot_target_price erreicht hat.
    Danach hören die Bots auf und nur echte Kunden können bieten.
    Dies stellt sicher, dass echtes Geld verdient wird, bevor Bots aufhören.
    """
    global bot_task_running
    
    logger.info("Bot continuous bidder started - Bots bieten bis zum Zielpreis")
    last_bot_per_auction = {}
    
    while bot_task_running:
        try:
            # Get auctions with bot targets that haven't reached the target yet
            active_auctions = await db.auctions.find({
                "status": "active",
                "bot_target_price": {"$gt": 0}
            }, {"_id": 0}).to_list(100)
            
            for auction in active_auctions:
                try:
                    # CHECK BUSINESS HOURS - Bots don't bid outside 9:00-24:00
                    now_utc = datetime.now(timezone.utc)
                    berlin_hour = (now_utc.hour + 1) % 24  # Approximate Berlin time
                    if berlin_hour < 9 or berlin_hour >= 24:
                        continue  # Skip bidding outside business hours
                    
                    end_time = datetime.fromisoformat(auction["end_time"].replace("Z", "+00:00"))
                    now = datetime.now(timezone.utc)
                    seconds_left = (end_time - now).total_seconds()
                    
                    # Bid when 1-5 seconds left
                    if 1 <= seconds_left <= 5:
                        target_price = auction.get("bot_target_price", 0)
                        current_price = auction.get("current_price", 0)
                        auction_id = auction.get("id")
                        bid_increment = auction.get("bid_increment", 0.01)
                        
                        # WICHTIG: Prüfe ob der AKTUELLE PREIS den Zielpreis erreicht hat
                        # Wenn ja, bieten Bots NICHT mehr - nur echte Kunden können jetzt bieten
                        # Wenn nein, bieten Bots weiter um den Preis zum Zielpreis zu treiben
                        
                        # Bots bieten nur wenn der aktuelle Preis UNTER dem Zielpreis liegt
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
                                current_price = auction.get("current_price", 0)
                                new_price = round(current_price + bid_increment, 2)
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


async def auction_auto_restart_processor():
    """Background task - automatically restart ALL ended auctions with same settings after a delay"""
    global bot_task_running
    
    logger.info("Auction auto-restart processor started - ALL ended auctions will restart automatically after 60 seconds")
    
    while bot_task_running:
        try:
            # CHECK BUSINESS HOURS - Don't restart outside 9:00-24:00
            now_utc = datetime.now(timezone.utc)
            berlin_hour = (now_utc.hour + 1) % 24  # Approximate Berlin/Dubai time
            if berlin_hour < 9:
                await asyncio.sleep(60)  # Check again in 1 minute
                continue
            
            # Find ALL ended auctions that have been ended for at least 60 seconds
            # This gives users time to see them in the "Ende" tab
            ended_auctions = await db.auctions.find({
                "status": "ended"
            }, {"_id": 0}).to_list(100)
            
            for auction in ended_auctions:
                try:
                    # Check if auction has been ended for at least 60 seconds
                    ended_at = auction.get("ended_at")
                    if ended_at:
                        try:
                            ended_time = datetime.fromisoformat(ended_at.replace("Z", "+00:00"))
                            seconds_since_ended = (now_utc - ended_time).total_seconds()
                            
                            # Wait at least 60 seconds before restarting
                            if seconds_since_ended < 60:
                                continue  # Skip this auction - not old enough yet
                        except:
                            pass  # If we can't parse ended_at, restart anyway
                    
                    # Get original duration from the auto_restart config or calculate from auction times
                    auto_restart = auction.get("auto_restart", {})
                    duration_minutes = auto_restart.get("duration_minutes")
                    
                    # If no duration in config, calculate from original auction
                    if not duration_minutes:
                        original_start = auction.get("original_start_time") or auction.get("start_time")
                        original_end = auction.get("original_end_time") or auction.get("end_time") or auction.get("ended_at")
                        
                        duration_minutes = 10  # Default 10 minutes
                        if original_start and original_end:
                            try:
                                start_dt = datetime.fromisoformat(original_start.replace("Z", "+00:00"))
                                end_dt = datetime.fromisoformat(original_end.replace("Z", "+00:00"))
                                original_duration = (end_dt - start_dt).total_seconds() / 60
                                if 1 <= original_duration <= 1440:  # Between 1 min and 24 hours
                                    duration_minutes = int(original_duration)
                            except:
                                pass
                    
                    # Keep the same bot target price
                    bot_target = auction.get("bot_target_price") or auto_restart.get("bot_target_price")
                    
                    now = datetime.now(timezone.utc)
                    new_end_time = now + timedelta(minutes=duration_minutes)
                    
                    # Store original times if not already stored (for duration calculation on next restart)
                    original_start_time = auction.get("original_start_time") or auction.get("start_time")
                    original_end_time = auction.get("original_end_time") or auction.get("end_time")
                    
                    # Reset auction to active state with SAME SETTINGS
                    update_data = {
                        "status": "active",
                        "start_time": now.isoformat(),
                        "end_time": new_end_time.isoformat(),
                        "current_price": 0.01,
                        "total_bids": 0,
                        "last_bidder_id": None,
                        "last_bidder_name": None,
                        "winner_id": None,
                        "winner_name": None,
                        "bid_history": [],
                        "ended_at": None,
                        "final_price": None,
                        "original_start_time": original_start_time,
                        "original_end_time": original_end_time
                    }
                    
                    # Keep the same bot target price
                    if bot_target and bot_target > 0:
                        update_data["bot_target_price"] = bot_target
                    
                    # Mark as auto-restarted for tracking
                    update_data["auto_restart"] = {
                        "enabled": True,
                        "duration_minutes": duration_minutes,
                        "bot_target_price": bot_target,
                        "last_restart": now.isoformat(),
                        "restart_count": auto_restart.get("restart_count", 0) + 1
                    }
                    
                    await db.auctions.update_one({"id": auction["id"]}, {"$set": update_data})
                    
                    product_name = auction.get("product", {}).get("name", auction["id"][:8])
                    logger.info(f"🔄 Auto-restarted: {product_name} for {duration_minutes} min" + 
                               (f" (Bot: €{bot_target})" if bot_target else ""))
                    
                except Exception as e:
                    logger.error(f"Auto-restart error for {auction.get('id')}: {e}")
            
            await asyncio.sleep(10)  # Check every 10 seconds
            
        except Exception as e:
            logger.error(f"Auto-restart processor error: {e}")
            await asyncio.sleep(30)
    
    logger.info("Auto-restart processor stopped")


async def auction_expiry_checker():
    """Background task - automatically end auctions that have expired"""
    global bot_task_running
    
    logger.info("Auction expiry checker started - Will end expired auctions automatically")
    
    while bot_task_running:
        try:
            now = datetime.now(timezone.utc)
            now_iso = now.isoformat()
            
            # Find active auctions that have passed their end time
            expired_auctions = await db.auctions.find({
                "status": "active",
                "end_time": {"$lt": now_iso}
            }, {"_id": 0}).to_list(100)
            
            for auction in expired_auctions:
                try:
                    auction_id = auction["id"]
                    
                    # Determine winner
                    winner_id = auction.get("last_bidder_id")
                    winner_name = auction.get("last_bidder_name")
                    final_price = auction.get("current_price", 0.01)
                    
                    # Update auction to ended status
                    await db.auctions.update_one(
                        {"id": auction_id},
                        {"$set": {
                            "status": "ended",
                            "ended_at": now_iso,
                            "final_price": final_price,
                            "winner_id": winner_id,
                            "winner_name": winner_name
                        }}
                    )
                    
                    # Create won auction record for user
                    if winner_id:
                        await db.won_auctions.insert_one({
                            "id": str(uuid.uuid4()),
                            "user_id": winner_id,
                            "auction_id": auction_id,
                            "product_id": auction.get("product_id"),
                            "product_name": auction.get("product", {}).get("name"),
                            "product_image": auction.get("product", {}).get("image_url"),
                            "final_price": final_price,
                            "retail_price": auction.get("product", {}).get("retail_price"),
                            "won_at": now_iso,
                            "status": "won"
                        })
                    
                    product_name = auction.get("product", {}).get("name", auction_id[:8])
                    logger.info(f"⏱️ Expired auction ended: {product_name} | Winner: {winner_name or 'None'} | Final: €{final_price}")
                    
                except Exception as e:
                    logger.error(f"Error ending expired auction {auction.get('id')}: {e}")
            
            await asyncio.sleep(5)  # Check every 5 seconds
            
        except Exception as e:
            logger.error(f"Auction expiry checker error: {e}")
            await asyncio.sleep(10)
    
    logger.info("Auction expiry checker stopped")


async def auction_reminder_processor():
    """Background task - process auction reminders and send push notifications"""
    global bot_task_running
    from routers.notifications import process_auction_reminders
    
    logger.info("Auction reminder processor started")
    
    while bot_task_running:
        try:
            await process_auction_reminders()
            await asyncio.sleep(30)  # Check every 30 seconds
        except Exception as e:
            logger.error(f"Reminder processor error: {e}")
            await asyncio.sleep(60)
    
    logger.info("Reminder processor stopped")


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
