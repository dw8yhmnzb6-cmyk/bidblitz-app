"""
BidBlitz V2 - Receipt/Invoice PDF Generator
Generates PDF receipts for transactions
"""

import io
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/receipts", tags=["Receipts"])
logger = logging.getLogger("bidblitz.receipts")


def generate_receipt_html(transaction: dict, user: dict, merchant: dict = None) -> str:
    """Generate HTML receipt that can be converted to PDF or printed."""
    
    now = datetime.now(timezone.utc)
    tx_date = transaction.get("created_at", now.isoformat())
    if isinstance(tx_date, str):
        try:
            tx_date = datetime.fromisoformat(tx_date.replace("Z", "+00:00"))
        except:
            tx_date = now
    
    amount = abs(transaction.get("amount", 0))
    fee = transaction.get("fee", 0)
    net = transaction.get("net", amount - fee)
    tx_type = transaction.get("type", "payment")
    
    # Transaction type labels
    type_labels = {
        "payment": "Zahlung",
        "topup": "Aufladung",
        "transfer_out": "Überweisung (Ausgang)",
        "transfer_in": "Überweisung (Eingang)",
        "auction_bid": "Auktionsgebot",
        "auction_win": "Auktionsgewinn",
        "refund": "Rückerstattung",
        "kids_allowance": "Taschengeld",
        "scooter_ride": "Scooter-Fahrt",
        "taxi_ride": "Taxi-Fahrt",
        "food_order": "Essensbestellung",
    }
    
    type_label = type_labels.get(tx_type, tx_type.replace("_", " ").title())
    
    merchant_name = merchant.get("business_name", merchant.get("name", "BidBlitz")) if merchant else "BidBlitz"
    merchant_address = merchant.get("address", "") if merchant else ""
    
    html = f"""
    <!DOCTYPE html>
    <html lang="de">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Quittung - BidBlitz</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f5f5f5;
                padding: 20px;
            }}
            .receipt {{
                max-width: 400px;
                margin: 0 auto;
                background: white;
                border-radius: 16px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                overflow: hidden;
            }}
            .header {{
                background: linear-gradient(135deg, #00C2FF 0%, #0066FF 100%);
                color: white;
                padding: 24px;
                text-align: center;
            }}
            .header h1 {{
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 4px;
            }}
            .header p {{
                font-size: 12px;
                opacity: 0.9;
            }}
            .content {{
                padding: 24px;
            }}
            .amount-box {{
                text-align: center;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 12px;
                margin-bottom: 20px;
            }}
            .amount {{
                font-size: 36px;
                font-weight: 700;
                color: #1a1a1a;
            }}
            .type {{
                font-size: 14px;
                color: #666;
                margin-top: 4px;
            }}
            .status {{
                display: inline-block;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                margin-top: 8px;
            }}
            .status.success {{ background: #d4edda; color: #155724; }}
            .status.pending {{ background: #fff3cd; color: #856404; }}
            .details {{
                border-top: 1px solid #eee;
                padding-top: 16px;
            }}
            .detail-row {{
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                font-size: 14px;
            }}
            .detail-row .label {{
                color: #666;
            }}
            .detail-row .value {{
                font-weight: 500;
                color: #1a1a1a;
            }}
            .footer {{
                text-align: center;
                padding: 16px 24px 24px;
                font-size: 11px;
                color: #999;
            }}
            .footer .tx-id {{
                font-family: monospace;
                background: #f5f5f5;
                padding: 4px 8px;
                border-radius: 4px;
                margin-top: 8px;
                display: inline-block;
            }}
            @media print {{
                body {{ background: white; padding: 0; }}
                .receipt {{ box-shadow: none; max-width: 100%; }}
            }}
        </style>
    </head>
    <body>
        <div class="receipt">
            <div class="header">
                <h1>BidBlitz</h1>
                <p>Digitale Quittung</p>
            </div>
            <div class="content">
                <div class="amount-box">
                    <div class="amount">€{amount:.2f}</div>
                    <div class="type">{type_label}</div>
                    <span class="status success">Abgeschlossen</span>
                </div>
                <div class="details">
                    <div class="detail-row">
                        <span class="label">Datum</span>
                        <span class="value">{tx_date.strftime("%d.%m.%Y")}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Uhrzeit</span>
                        <span class="value">{tx_date.strftime("%H:%M:%S")}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Empfänger</span>
                        <span class="value">{merchant_name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Zahler</span>
                        <span class="value">{user.get("name", user.get("email", "Kunde"))}</span>
                    </div>
                    {f'<div class="detail-row"><span class="label">Gebühr</span><span class="value">€{fee:.2f}</span></div>' if fee > 0 else ''}
                    {f'<div class="detail-row"><span class="label">Netto</span><span class="value">€{net:.2f}</span></div>' if fee > 0 else ''}
                    <div class="detail-row">
                        <span class="label">Zahlungsmethode</span>
                        <span class="value">BidBlitz Wallet</span>
                    </div>
                </div>
            </div>
            <div class="footer">
                <p>Vielen Dank für Ihre Zahlung!</p>
                <p>Diese Quittung wurde elektronisch erstellt.</p>
                <div class="tx-id">TX: {transaction.get("transaction_id", transaction.get("id", "N/A"))[:16]}</div>
            </div>
        </div>
    </body>
    </html>
    """
    return html


@router.get("/{transaction_id}")
async def get_receipt(transaction_id: str, request: Request):
    """Get receipt for a transaction as HTML (for printing/PDF)."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Find transaction
    tx = await db.transactions.find_one({
        "$or": [
            {"transaction_id": transaction_id},
            {"id": transaction_id},
        ],
        "$or": [
            {"user_id": user_id},
            {"sender_id": user_id},
            {"recipient_id": user_id},
        ]
    })
    
    if not tx:
        # Also check payment_transactions
        tx = await db.payment_transactions.find_one({
            "transaction_id": transaction_id,
            "user_id": user_id,
        })
    
    if not tx:
        raise HTTPException(status_code=404, detail="Transaktion nicht gefunden")
    
    tx.pop("_id", None)
    
    # Get merchant info if available
    merchant = None
    if tx.get("merchant_id"):
        merchant = await db.merchants.find_one({"merchant_id": tx["merchant_id"]})
        if merchant:
            merchant.pop("_id", None)
    
    html = generate_receipt_html(tx, user, merchant)
    
    return StreamingResponse(
        io.BytesIO(html.encode("utf-8")),
        media_type="text/html",
        headers={
            "Content-Disposition": f'inline; filename="quittung_{transaction_id[:8]}.html"'
        }
    )


@router.get("/{transaction_id}/json")
async def get_receipt_json(transaction_id: str, request: Request):
    """Get receipt data as JSON."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    tx = await db.transactions.find_one({
        "$or": [
            {"transaction_id": transaction_id},
            {"id": transaction_id},
        ]
    })
    
    if not tx:
        tx = await db.payment_transactions.find_one({"transaction_id": transaction_id})
    
    if not tx:
        raise HTTPException(status_code=404, detail="Transaktion nicht gefunden")
    
    # Verify user owns this transaction
    if tx.get("user_id") != user_id and tx.get("sender_id") != user_id and tx.get("recipient_id") != user_id:
        raise HTTPException(status_code=403, detail="Nicht autorisiert")
    
    tx.pop("_id", None)
    
    return {
        "transaction": tx,
        "user": {
            "name": user.get("name"),
            "email": user.get("email"),
        },
        "receipt_url": f"/api/receipts/{transaction_id}",
    }
