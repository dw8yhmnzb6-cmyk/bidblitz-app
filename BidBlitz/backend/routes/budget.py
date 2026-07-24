"""
BidBlitz V2 - Budget Planner
Category-based spending tracker with limits and trends
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from core.security import get_current_user
from core.database import db
from datetime import datetime, timezone, timedelta
from typing import Optional
import secrets

router = APIRouter(prefix="/api/budget", tags=["budget"])

DEFAULT_CATEGORIES = [
    {"id": "food", "name": "Essen & Trinken", "icon": "utensils", "color": "#FF6B6B"},
    {"id": "transport", "name": "Transport", "icon": "car", "color": "#4ECDC4"},
    {"id": "shopping", "name": "Shopping", "icon": "shopping-bag", "color": "#A855F7"},
    {"id": "entertainment", "name": "Unterhaltung", "icon": "gamepad", "color": "#F59E0B"},
    {"id": "bills", "name": "Rechnungen", "icon": "file-text", "color": "#3B82F6"},
    {"id": "health", "name": "Gesundheit", "icon": "heart", "color": "#EC4899"},
    {"id": "education", "name": "Bildung", "icon": "book", "color": "#10B981"},
    {"id": "other", "name": "Sonstiges", "icon": "circle", "color": "#6B7280"},
]


class BudgetLimit(BaseModel):
    category_id: str
    monthly_limit: float


class AddExpense(BaseModel):
    category_id: str
    amount: float
    note: Optional[str] = ""


@router.get("/overview")
async def budget_overview(request: Request, month: str = ""):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    

    
    # Current month
    now = datetime.now(timezone.utc)
    if month:
        try:
            target = datetime.strptime(month, "%Y-%m").replace(tzinfo=timezone.utc)
        except ValueError:
            target = now
    else:
        target = now
    
    month_start = target.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if target.month == 12:
        month_end = month_start.replace(year=target.year + 1, month=1)
    else:
        month_end = month_start.replace(month=target.month + 1)
    
    # Get user's budget limits
    limits = {}
    user_limits = await db.budget_limits.find(
        {"user_id": user_id}, {"_id": 0}
    ).to_list(100)
    for l in user_limits:
        limits[l["category_id"]] = l["monthly_limit"]
    
    # Get expenses for this month
    expenses = await db.budget_expenses.find({
        "user_id": user_id,
        "created_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}
    }, {"_id": 0}).to_list(500)
    
    # Also analyze real transactions
    transactions = await db.transactions.find({
        "user_id": user_id,
        "type": {"$in": ["payment", "debit", "transfer_out"]},
        "created_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}
    }, {"_id": 0, "amount": 1, "category": 1, "description": 1, "created_at": 1}).to_list(500)
    
    # Aggregate by category
    category_spending = {}
    for e in expenses:
        cid = e.get("category_id", "other")
        category_spending[cid] = category_spending.get(cid, 0) + e.get("amount", 0)
    
    for t in transactions:
        cat = t.get("category", "other")
        category_spending[cat] = category_spending.get(cat, 0) + t.get("amount", 0)
    
    total_spent = sum(category_spending.values())
    total_limit = sum(limits.values()) if limits else 0
    
    categories = []
    for cat in DEFAULT_CATEGORIES:
        spent = round(category_spending.get(cat["id"], 0), 2)
        limit = limits.get(cat["id"], 0)
        categories.append({
            **cat,
            "spent": spent,
            "limit": limit,
            "percentage": round((spent / limit * 100) if limit > 0 else 0, 1),
            "over_budget": spent > limit if limit > 0 else False,
        })
    
    return {
        "month": month_start.strftime("%Y-%m"),
        "total_spent": round(total_spent, 2),
        "total_limit": round(total_limit, 2),
        "categories": categories,
        "expense_count": len(expenses) + len(transactions),
    }


@router.post("/limits")
async def set_budget_limit(req: BudgetLimit, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    

    await db.budget_limits.update_one(
        {"user_id": user_id, "category_id": req.category_id},
        {"$set": {"monthly_limit": req.monthly_limit, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True}


@router.post("/expense")
async def add_expense(req: AddExpense, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    if req.amount <= 0:
        raise HTTPException(400, "Betrag muss positiv sein")
    

    expense = {
        "id": secrets.token_hex(8),
        "user_id": user_id,
        "category_id": req.category_id,
        "amount": req.amount,
        "note": req.note,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.budget_expenses.insert_one(expense)
    del expense["_id"]
    return {"expense": expense}


@router.get("/trends")
async def get_trends(request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    

    now = datetime.now(timezone.utc)
    
    months_data = []
    for i in range(6):
        target = now.replace(day=1) - timedelta(days=i * 30)
        month_start = target.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if month_start.month == 12:
            month_end = month_start.replace(year=month_start.year + 1, month=1)
        else:
            month_end = month_start.replace(month=month_start.month + 1)
        
        expenses = await db.budget_expenses.find({
            "user_id": user_id,
            "created_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}
        }, {"_id": 0, "amount": 1}).to_list(500)
        
        transactions = await db.transactions.find({
            "user_id": user_id,
            "type": {"$in": ["payment", "debit"]},
            "created_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}
        }, {"_id": 0, "amount": 1}).to_list(500)
        
        total = sum(e.get("amount", 0) for e in expenses) + sum(t.get("amount", 0) for t in transactions)
        months_data.append({
            "month": month_start.strftime("%Y-%m"),
            "label": month_start.strftime("%b"),
            "total": round(total, 2),
        })
    
    months_data.reverse()
    return {"trends": months_data}
