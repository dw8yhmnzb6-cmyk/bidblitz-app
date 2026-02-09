"""
Team Bidding Router - Group auctions where friends bid together
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import random
import string

router = APIRouter(prefix="/team-bidding", tags=["Team Bidding"])

class CreateTeamRequest(BaseModel):
    name: str
    auction_id: str
    max_members: int = 5

class JoinTeamRequest(BaseModel):
    invite_code: str

class ContributeBidsRequest(BaseModel):
    bid_amount: int

class TeamChatRequest(BaseModel):
    message: str

def generate_invite_code():
    """Generate a 6-character invite code"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

@router.post("/create")
async def create_team(data: CreateTeamRequest):
    """Create a new bidding team"""
    from server import db, get_current_user_optional
    
    invite_code = generate_invite_code()
    
    team = {
        "name": data.name,
        "auction_id": data.auction_id,
        "invite_code": invite_code,
        "max_members": data.max_members,
        "members": [],
        "total_bids_pool": 0,
        "bids_used": 0,
        "status": "recruiting",  # recruiting, active, won, lost
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.teams.insert_one(team)
    team["id"] = str(result.inserted_id)
    
    return {
        "success": True,
        "team": team,
        "invite_code": invite_code,
        "share_link": f"bidblitz://team/{invite_code}"
    }

@router.post("/join")
async def join_team(data: JoinTeamRequest):
    """Join a team using invite code"""
    from server import db
    
    team = await db.teams.find_one({"invite_code": data.invite_code.upper()})
    if not team:
        raise HTTPException(status_code=404, detail="Team nicht gefunden")
    
    if team["status"] != "recruiting":
        raise HTTPException(status_code=400, detail="Team nimmt keine neuen Mitglieder auf")
    
    if len(team["members"]) >= team["max_members"]:
        raise HTTPException(status_code=400, detail="Team ist voll")
    
    # Add member (in production, use actual user ID)
    member = {
        "user_id": f"user_{random.randint(1000, 9999)}",
        "name": f"Spieler {len(team['members']) + 1}",
        "contributed_bids": 0,
        "joined_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.teams.update_one(
        {"_id": team["_id"]},
        {"$push": {"members": member}}
    )
    
    team["id"] = str(team.pop("_id"))
    team["members"].append(member)
    
    return {
        "success": True,
        "team": team,
        "message": f"Du bist Team '{team['name']}' beigetreten!"
    }

@router.get("/my-teams")
async def get_my_teams():
    """Get all teams the user is part of"""
    from server import db
    
    # In production, filter by actual user ID
    teams = await db.teams.find({}).sort("created_at", -1).limit(10).to_list(10)
    
    for team in teams:
        team["id"] = str(team.pop("_id"))
        
        # Get auction info
        if team.get("auction_id"):
            auction = await db.auctions.find_one({"_id": ObjectId(team["auction_id"])})
            if auction:
                auction["id"] = str(auction.pop("_id"))
                team["auction"] = auction
    
    return teams

@router.get("/{team_id}")
async def get_team(team_id: str):
    """Get team details"""
    from server import db
    
    team = await db.teams.find_one({"_id": ObjectId(team_id)})
    if not team:
        raise HTTPException(status_code=404, detail="Team nicht gefunden")
    
    team["id"] = str(team.pop("_id"))
    
    # Get auction info
    if team.get("auction_id"):
        auction = await db.auctions.find_one({"_id": ObjectId(team["auction_id"])})
        if auction:
            auction["id"] = str(auction.pop("_id"))
            team["auction"] = auction
    
    # Get chat messages
    messages = await db.team_chat.find({
        "team_id": team_id
    }).sort("created_at", -1).limit(50).to_list(50)
    
    for msg in messages:
        msg["id"] = str(msg.pop("_id"))
    
    team["chat"] = list(reversed(messages))
    
    return team

@router.post("/{team_id}/contribute")
async def contribute_bids(team_id: str, data: ContributeBidsRequest):
    """Contribute bids to the team pool"""
    from server import db
    
    team = await db.teams.find_one({"_id": ObjectId(team_id)})
    if not team:
        raise HTTPException(status_code=404, detail="Team nicht gefunden")
    
    # Update pool
    await db.teams.update_one(
        {"_id": ObjectId(team_id)},
        {"$inc": {"total_bids_pool": data.bid_amount}}
    )
    
    return {
        "success": True,
        "new_pool_total": team["total_bids_pool"] + data.bid_amount,
        "message": f"+{data.bid_amount} Gebote zum Team-Pool hinzugefügt!"
    }

@router.post("/{team_id}/bid")
async def team_bid(team_id: str):
    """Place a bid using team pool"""
    from server import db
    
    team = await db.teams.find_one({"_id": ObjectId(team_id)})
    if not team:
        raise HTTPException(status_code=404, detail="Team nicht gefunden")
    
    available_bids = team["total_bids_pool"] - team["bids_used"]
    if available_bids < 1:
        raise HTTPException(status_code=400, detail="Keine Gebote im Team-Pool")
    
    # Use a bid from pool
    await db.teams.update_one(
        {"_id": ObjectId(team_id)},
        {"$inc": {"bids_used": 1}}
    )
    
    return {
        "success": True,
        "bids_remaining": available_bids - 1,
        "message": "Team-Gebot platziert!"
    }

@router.post("/{team_id}/chat")
async def send_team_chat(team_id: str, data: TeamChatRequest):
    """Send message in team chat"""
    from server import db
    
    message = {
        "team_id": team_id,
        "user_name": f"Spieler_{random.randint(1, 5)}",
        "message": data.message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.team_chat.insert_one(message)
    message["id"] = str(result.inserted_id)
    
    return message

@router.get("/{team_id}/leaderboard")
async def get_team_leaderboard(team_id: str):
    """Get contribution leaderboard for team"""
    from server import db
    
    team = await db.teams.find_one({"_id": ObjectId(team_id)})
    if not team:
        raise HTTPException(status_code=404, detail="Team nicht gefunden")
    
    # Sort members by contribution
    members = sorted(team.get("members", []), key=lambda x: x.get("contributed_bids", 0), reverse=True)
    
    return {
        "team_name": team["name"],
        "total_pool": team["total_bids_pool"],
        "bids_used": team["bids_used"],
        "leaderboard": members
    }
