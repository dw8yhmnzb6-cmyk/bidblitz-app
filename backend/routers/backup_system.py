"""
Daten-Backup & Export System
Sichert alle wichtigen Daten und ermöglicht Export/Import
"""

from fastapi import APIRouter, HTTPException, Header, BackgroundTasks
from fastapi.responses import JSONResponse, StreamingResponse
from datetime import datetime, timezone, timedelta
from typing import Optional
import json
import io
import logging

from config import db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/backup", tags=["Backup System"])


# Liste aller wichtigen Collections
BACKUP_COLLECTIONS = [
    "users",
    "sessions",
    "bids",
    "auctions",
    "products",
    "payments",
    "vouchers",
    "orders",
    "enterprise_accounts",
    "enterprise_users",
    "enterprise_branches",
    "enterprise_api_keys",
    "enterprise_sessions",
    "enterprise_payouts",
    "enterprise_transactions",
    "enterprise_commission_settings",
    "enterprise_payout_settings",
    "digital_transactions",
    "cashback_transactions",
    "restaurants",
    "restaurant_vouchers",
    "wishlists",
    "notifications",
    "bot_bids",
    "analytics_events",
    "product_views",
    "product_interactions",
    "product_view_stats",
    "health_reports",
    "enterprise_report_logs",
]


@router.get("/status")
async def get_backup_status():
    """Zeigt den aktuellen Status aller Daten-Collections."""
    
    status = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "collections": {},
        "total_documents": 0,
        "total_collections": 0
    }
    
    for collection_name in BACKUP_COLLECTIONS:
        try:
            count = await db[collection_name].count_documents({})
            if count > 0:
                status["collections"][collection_name] = {
                    "documents": count,
                    "status": "ok"
                }
                status["total_documents"] += count
                status["total_collections"] += 1
        except Exception as e:
            status["collections"][collection_name] = {
                "documents": 0,
                "status": "error",
                "error": str(e)
            }
    
    return status


@router.get("/export/{collection_name}")
async def export_collection(collection_name: str, limit: int = 10000):
    """Exportiert eine einzelne Collection als JSON."""
    
    if collection_name not in BACKUP_COLLECTIONS:
        raise HTTPException(status_code=400, detail=f"Collection '{collection_name}' nicht erlaubt")
    
    try:
        documents = await db[collection_name].find({}, {"_id": 0}).to_list(limit)
        
        return {
            "collection": collection_name,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "count": len(documents),
            "data": documents
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export fehlgeschlagen: {str(e)}")


@router.get("/export-all")
async def export_all_data():
    """Exportiert ALLE Daten aus allen Collections."""
    
    export_data = {
        "backup_version": "1.0",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "collections": {},
        "statistics": {
            "total_documents": 0,
            "total_collections": 0
        }
    }
    
    for collection_name in BACKUP_COLLECTIONS:
        try:
            documents = await db[collection_name].find({}, {"_id": 0}).to_list(50000)
            if documents:
                export_data["collections"][collection_name] = documents
                export_data["statistics"]["total_documents"] += len(documents)
                export_data["statistics"]["total_collections"] += 1
        except Exception as e:
            logger.error(f"Error exporting {collection_name}: {str(e)}")
    
    return export_data


@router.get("/download")
async def download_backup():
    """Lädt ein vollständiges Backup als JSON-Datei herunter."""
    
    export_data = {
        "backup_version": "1.0",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "collections": {},
        "statistics": {
            "total_documents": 0,
            "total_collections": 0
        }
    }
    
    for collection_name in BACKUP_COLLECTIONS:
        try:
            documents = await db[collection_name].find({}, {"_id": 0}).to_list(50000)
            if documents:
                export_data["collections"][collection_name] = documents
                export_data["statistics"]["total_documents"] += len(documents)
                export_data["statistics"]["total_collections"] += 1
        except Exception as e:
            logger.error(f"Error exporting {collection_name}: {str(e)}")
    
    # Create JSON file in memory
    json_str = json.dumps(export_data, ensure_ascii=False, indent=2, default=str)
    
    filename = f"bidblitz_backup_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
    
    return StreamingResponse(
        io.BytesIO(json_str.encode('utf-8')),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.post("/import/{collection_name}")
async def import_collection(collection_name: str, data: dict):
    """Importiert Daten in eine Collection (fügt hinzu, überschreibt nicht)."""
    
    if collection_name not in BACKUP_COLLECTIONS:
        raise HTTPException(status_code=400, detail=f"Collection '{collection_name}' nicht erlaubt")
    
    documents = data.get("data", [])
    if not documents:
        raise HTTPException(status_code=400, detail="Keine Daten zum Importieren")
    
    try:
        # Insert documents (skip duplicates based on 'id' field if exists)
        inserted = 0
        skipped = 0
        
        for doc in documents:
            if "id" in doc:
                # Check if document already exists
                existing = await db[collection_name].find_one({"id": doc["id"]})
                if existing:
                    skipped += 1
                    continue
            
            await db[collection_name].insert_one(doc)
            inserted += 1
        
        return {
            "success": True,
            "collection": collection_name,
            "inserted": inserted,
            "skipped": skipped,
            "total_processed": len(documents)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import fehlgeschlagen: {str(e)}")


@router.get("/summary")
async def get_data_summary():
    """Zeigt eine Zusammenfassung aller gespeicherten Daten."""
    
    summary = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data_overview": {
            "users": {
                "total": await db.users.count_documents({}),
                "with_bids": await db.users.count_documents({"bids_balance": {"$gt": 0}}),
                "vip": await db.users.count_documents({"vip_status": True})
            },
            "enterprises": {
                "total": await db.enterprise_accounts.count_documents({}),
                "approved": await db.enterprise_accounts.count_documents({"status": "approved"}),
                "branches": await db.enterprise_branches.count_documents({}),
                "employees": await db.enterprise_users.count_documents({})
            },
            "products": {
                "total": await db.products.count_documents({})
            },
            "auctions": {
                "total": await db.auctions.count_documents({}),
                "active": await db.auctions.count_documents({"status": "active"}),
                "ended": await db.auctions.count_documents({"status": "ended"})
            },
            "transactions": {
                "payments": await db.payments.count_documents({}),
                "digital": await db.digital_transactions.count_documents({}),
                "cashback": await db.cashback_transactions.count_documents({})
            },
            "analytics": {
                "product_views": await db.product_views.count_documents({}),
                "health_reports": await db.health_reports.count_documents({})
            }
        }
    }
    
    return summary


@router.delete("/cleanup-test-data")
async def cleanup_test_data(confirm: bool = False):
    """
    VORSICHT: Löscht nur Test-Daten (mit 'test' im Namen/Email).
    Benötigt confirm=true als Parameter.
    """
    
    if not confirm:
        raise HTTPException(
            status_code=400, 
            detail="Bestätigung erforderlich: ?confirm=true"
        )
    
    deleted = {
        "users": 0,
        "enterprise_accounts": 0,
        "enterprise_users": 0
    }
    
    # Delete test users
    result = await db.users.delete_many({
        "$or": [
            {"email": {"$regex": "test", "$options": "i"}},
            {"name": {"$regex": "test", "$options": "i"}}
        ]
    })
    deleted["users"] = result.deleted_count
    
    # Delete test enterprises
    result = await db.enterprise_accounts.delete_many({
        "$or": [
            {"email": {"$regex": "test", "$options": "i"}},
            {"company_name": {"$regex": "test", "$options": "i"}}
        ]
    })
    deleted["enterprise_accounts"] = result.deleted_count
    
    # Delete test enterprise users
    result = await db.enterprise_users.delete_many({
        "$or": [
            {"email": {"$regex": "test", "$options": "i"}},
            {"name": {"$regex": "test", "$options": "i"}}
        ]
    })
    deleted["enterprise_users"] = result.deleted_count
    
    return {
        "success": True,
        "deleted": deleted,
        "warning": "Nur Test-Daten wurden gelöscht. Echte Daten bleiben erhalten."
    }
