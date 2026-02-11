"""
Sustainability Stats Router - BidBlitz Corporate Social Responsibility
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from config import db, logger
from utils.auth import get_current_user, get_admin_user

router = APIRouter(prefix="/api/sustainability", tags=["sustainability"])


class SustainabilityStats(BaseModel):
    trees_planted: int = 0
    projects_supported: int = 0
    co2_offset_kg: int = 0
    donations_total: float = 0
    last_updated: Optional[str] = None


class SustainabilityUpdate(BaseModel):
    trees_planted: Optional[int] = None
    projects_supported: Optional[int] = None
    co2_offset_kg: Optional[int] = None
    donations_total: Optional[float] = None


class ProjectCreate(BaseModel):
    name: str
    description: str
    category: str  # trees, donations, climate, community
    amount: float = 0
    impact_value: int = 0  # trees planted, kg CO2, etc.
    location: str = ""
    image_url: str = ""


# Default stats if none exist
DEFAULT_STATS = {
    "trees_planted": 2847,
    "projects_supported": 23,
    "co2_offset_kg": 15420,
    "donations_total": 12500.00,
    "last_updated": datetime.now(timezone.utc).isoformat()
}


@router.get("/stats")
async def get_sustainability_stats():
    """Get current sustainability statistics"""
    stats = await db.sustainability_stats.find_one({"type": "global"}, {"_id": 0})
    
    if not stats:
        # Create default stats
        stats = {**DEFAULT_STATS, "type": "global"}
        await db.sustainability_stats.insert_one(stats)
        del stats["type"]
    else:
        del stats["type"]
    
    return stats


@router.put("/stats")
async def update_sustainability_stats(
    update: SustainabilityUpdate,
    current_user: dict = Depends(get_admin_user)
):
    """Update sustainability statistics (Admin only)"""
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    update_data["last_updated"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.sustainability_stats.update_one(
        {"type": "global"},
        {"$set": update_data},
        upsert=True
    )
    
    logger.info(f"Admin {current_user['email']} updated sustainability stats: {update_data}")
    
    # Get updated stats
    stats = await db.sustainability_stats.find_one({"type": "global"}, {"_id": 0, "type": 0})
    return {"message": "Statistiken aktualisiert", "stats": stats}


@router.post("/stats/increment")
async def increment_stats(
    trees: int = 0,
    co2: int = 0,
    current_user: dict = Depends(get_admin_user)
):
    """Increment specific stats (Admin only)"""
    update = {}
    if trees > 0:
        update["trees_planted"] = trees
    if co2 > 0:
        update["co2_offset_kg"] = co2
    
    if update:
        await db.sustainability_stats.update_one(
            {"type": "global"},
            {
                "$inc": update,
                "$set": {"last_updated": datetime.now(timezone.utc).isoformat()}
            },
            upsert=True
        )
    
    stats = await db.sustainability_stats.find_one({"type": "global"}, {"_id": 0, "type": 0})
    return {"message": "Statistiken erhöht", "stats": stats}


# Projects Management
@router.get("/projects")
async def get_projects():
    """Get all sustainability projects"""
    projects = await db.sustainability_projects.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return projects


@router.post("/projects")
async def create_project(
    project: ProjectCreate,
    current_user: dict = Depends(get_admin_user)
):
    """Create a new sustainability project (Admin only)"""
    import uuid
    
    project_data = {
        "id": str(uuid.uuid4()),
        **project.dict(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["email"],
        "status": "active"
    }
    
    await db.sustainability_projects.insert_one(project_data)
    
    # Update global stats based on category
    update = {}
    if project.category == "trees":
        update["trees_planted"] = project.impact_value
    elif project.category == "climate":
        update["co2_offset_kg"] = project.impact_value
    elif project.category == "donations":
        update["donations_total"] = project.amount
    
    if update:
        await db.sustainability_stats.update_one(
            {"type": "global"},
            {
                "$inc": {**update, "projects_supported": 1},
                "$set": {"last_updated": datetime.now(timezone.utc).isoformat()}
            },
            upsert=True
        )
    
    if "_id" in project_data:
        del project_data["_id"]
    logger.info(f"Admin {current_user['email']} created sustainability project: {project.name}")
    
    return {"message": "Projekt erstellt", "project": project_data}


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: str,
    current_user: dict = Depends(get_admin_user)
):
    """Delete a sustainability project (Admin only)"""
    result = await db.sustainability_projects.delete_one({"id": project_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    
    logger.info(f"Admin {current_user['email']} deleted sustainability project: {project_id}")
    return {"message": "Projekt gelöscht"}
