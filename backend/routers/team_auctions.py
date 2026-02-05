"""Team Auctions - Users can team up to bid together"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import uuid

from config import db, logger
from dependencies import get_current_user

router = APIRouter(prefix="/team-auctions", tags=["Team Auctions"])

# ==================== TEAM MANAGEMENT ====================

@router.post("/create")
async def create_team(
    name: str,
    description: str = "",
    max_members: int = 5,
    user: dict = Depends(get_current_user)
):
    """Create a new bidding team"""
    # Check if user already has a team
    existing = await db.bidding_teams.find_one({"leader_id": user["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Du hast bereits ein Team erstellt")
    
    team_id = str(uuid.uuid4())
    invite_code = str(uuid.uuid4())[:8].upper()
    
    team = {
        "id": team_id,
        "name": name,
        "description": description,
        "leader_id": user["id"],
        "leader_name": user.get("name", "Anonym"),
        "members": [{
            "user_id": user["id"],
            "name": user.get("name", "Anonym"),
            "role": "leader",
            "joined_at": datetime.now(timezone.utc).isoformat()
        }],
        "max_members": min(10, max(2, max_members)),
        "invite_code": invite_code,
        "total_wins": 0,
        "total_bids_placed": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "active"
    }
    
    await db.bidding_teams.insert_one(team)
    
    # Update user's team membership
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"team_id": team_id, "team_role": "leader"}}
    )
    
    del team["_id"]
    return {"team": team, "invite_code": invite_code}

@router.post("/join/{invite_code}")
async def join_team(invite_code: str, user: dict = Depends(get_current_user)):
    """Join a team using invite code"""
    # Check if user already in a team
    if user.get("team_id"):
        raise HTTPException(status_code=400, detail="Du bist bereits in einem Team")
    
    team = await db.bidding_teams.find_one({"invite_code": invite_code.upper()})
    if not team:
        raise HTTPException(status_code=404, detail="Team nicht gefunden")
    
    if len(team.get("members", [])) >= team.get("max_members", 5):
        raise HTTPException(status_code=400, detail="Team ist voll")
    
    # Add member
    new_member = {
        "user_id": user["id"],
        "name": user.get("name", "Anonym"),
        "role": "member",
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.bidding_teams.update_one(
        {"id": team["id"]},
        {"$push": {"members": new_member}}
    )
    
    # Update user
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"team_id": team["id"], "team_role": "member"}}
    )
    
    return {"message": f"Du bist dem Team '{team['name']}' beigetreten!", "team_id": team["id"]}

@router.post("/leave")
async def leave_team(user: dict = Depends(get_current_user)):
    """Leave current team"""
    team_id = user.get("team_id")
    if not team_id:
        raise HTTPException(status_code=400, detail="Du bist in keinem Team")
    
    team = await db.bidding_teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Team nicht gefunden")
    
    # If leader, delete team
    if team.get("leader_id") == user["id"]:
        # Remove all members' team references
        for member in team.get("members", []):
            await db.users.update_one(
                {"id": member["user_id"]},
                {"$unset": {"team_id": "", "team_role": ""}}
            )
        await db.bidding_teams.delete_one({"id": team_id})
        return {"message": "Team wurde aufgelöst"}
    
    # Remove member
    await db.bidding_teams.update_one(
        {"id": team_id},
        {"$pull": {"members": {"user_id": user["id"]}}}
    )
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$unset": {"team_id": "", "team_role": ""}}
    )
    
    return {"message": "Du hast das Team verlassen"}

@router.get("/my-team")
async def get_my_team(user: dict = Depends(get_current_user)):
    """Get current user's team"""
    team_id = user.get("team_id")
    if not team_id:
        return {"team": None, "message": "Du bist in keinem Team"}
    
    team = await db.bidding_teams.find_one({"id": team_id}, {"_id": 0})
    if not team:
        return {"team": None, "message": "Team nicht gefunden"}
    
    # Get team statistics
    team_wins = await db.auction_history.count_documents({
        "winner_id": {"$in": [m["user_id"] for m in team.get("members", [])]}
    })
    
    team["stats"] = {
        "total_wins": team_wins,
        "member_count": len(team.get("members", []))
    }
    
    return {"team": team}

@router.get("/list")
async def list_teams(limit: int = 20):
    """List public teams (for discovery)"""
    teams = await db.bidding_teams.find(
        {"status": "active"},
        {"_id": 0, "invite_code": 0}  # Don't expose invite codes
    ).sort("total_wins", -1).limit(limit).to_list(limit)
    
    return {"teams": teams}

# ==================== TEAM BIDDING ====================

@router.post("/bid/{auction_id}")
async def team_bid(auction_id: str, user: dict = Depends(get_current_user)):
    """Place a bid on behalf of the team"""
    team_id = user.get("team_id")
    if not team_id:
        raise HTTPException(status_code=400, detail="Du bist in keinem Team")
    
    team = await db.bidding_teams.find_one({"id": team_id})
    if not team:
        raise HTTPException(status_code=404, detail="Team nicht gefunden")
    
    # Check if user has bids
    if user.get("bid_balance", 0) < 1:
        raise HTTPException(status_code=400, detail="Nicht genug Gebote")
    
    # Place bid
    auction = await db.auctions.find_one({"id": auction_id, "status": "active"})
    if not auction:
        raise HTTPException(status_code=404, detail="Auktion nicht gefunden")
    
    new_price = round(auction.get("current_price", 0) + auction.get("bid_increment", 0.01), 2)
    
    bid_entry = {
        "user_id": user["id"],
        "user_name": f"Team {team['name']} ({user.get('name', 'Anonym')})",
        "team_id": team_id,
        "team_name": team["name"],
        "price": new_price,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "is_team_bid": True
    }
    
    # Update auction
    new_end_time = datetime.now(timezone.utc) + timedelta(seconds=15)
    
    await db.auctions.update_one(
        {"id": auction_id},
        {
            "$set": {
                "current_price": new_price,
                "end_time": new_end_time.isoformat(),
                "last_bidder_id": user["id"],
                "last_bidder_name": f"Team {team['name']}",
                "last_team_id": team_id
            },
            "$inc": {"total_bids": 1},
            "$push": {"bid_history": bid_entry}
        }
    )
    
    # Deduct bid from user
    await db.users.update_one(
        {"id": user["id"]},
        {"$inc": {"bid_balance": -1, "total_bids_placed": 1}}
    )
    
    # Update team stats
    await db.bidding_teams.update_one(
        {"id": team_id},
        {"$inc": {"total_bids_placed": 1}}
    )
    
    return {
        "success": True,
        "new_price": new_price,
        "team_name": team["name"],
        "message": f"Team-Gebot platziert: €{new_price:.2f}"
    }

# ==================== TEAM CHAT ====================

@router.post("/chat/{team_id}")
async def send_team_message(
    team_id: str,
    message: str,
    user: dict = Depends(get_current_user)
):
    """Send a message to team chat"""
    if user.get("team_id") != team_id:
        raise HTTPException(status_code=403, detail="Du bist nicht in diesem Team")
    
    chat_msg = {
        "id": str(uuid.uuid4()),
        "team_id": team_id,
        "user_id": user["id"],
        "user_name": user.get("name", "Anonym"),
        "message": message[:500],  # Limit message length
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.team_chat.insert_one(chat_msg)
    
    del chat_msg["_id"]
    return chat_msg

@router.get("/chat/{team_id}")
async def get_team_chat(team_id: str, limit: int = 50, user: dict = Depends(get_current_user)):
    """Get team chat messages"""
    if user.get("team_id") != team_id:
        raise HTTPException(status_code=403, detail="Du bist nicht in diesem Team")
    
    messages = await db.team_chat.find(
        {"team_id": team_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {"messages": list(reversed(messages))}
