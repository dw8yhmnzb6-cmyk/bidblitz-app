#!/usr/bin/env python3
"""
BidBlitz MongoDB to PostgreSQL Migration Script
Migrates data from MongoDB to PostgreSQL
"""
import asyncio
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

load_dotenv(Path(__file__).parent / '.env')

# MongoDB
from motor.motor_asyncio import AsyncIOMotorClient

# PostgreSQL
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from pg_models import Base, User, Wallet, Game, GameScore, Auction, Product, Transaction

# Configuration
MONGO_URL = os.environ.get('MONGO_URL')
DATABASE_URL = os.environ.get('DATABASE_URL')
DB_NAME = os.environ.get('DB_NAME', 'bidblitz')

def get_sync_pg_session():
    """Get synchronous PostgreSQL session for migration"""
    if not DATABASE_URL:
        raise Exception("DATABASE_URL not set")
    
    sync_url = DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://')
    engine = create_engine(sync_url)
    Session = sessionmaker(bind=engine)
    return Session(), engine

async def get_mongo_db():
    """Get MongoDB connection"""
    if not MONGO_URL:
        raise Exception("MONGO_URL not set")
    
    client = AsyncIOMotorClient(MONGO_URL)
    return client[DB_NAME]

async def migrate_users(mongo_db, pg_session):
    """Migrate users from MongoDB to PostgreSQL"""
    print("📦 Migrating users...")
    
    users = await mongo_db.users.find({}, {"_id": 0}).to_list(10000)
    migrated = 0
    
    for user_data in users:
        try:
            user = User(
                id=user_data.get('id', str(user_data.get('_id', ''))),
                email=user_data.get('email', ''),
                username=user_data.get('username'),
                password_hash=user_data.get('password', user_data.get('password_hash', '')),
                first_name=user_data.get('first_name'),
                last_name=user_data.get('last_name'),
                phone=user_data.get('phone'),
                role=user_data.get('role', 'customer'),
                is_active=user_data.get('is_active', True),
                is_verified=user_data.get('is_verified', False),
                avatar_url=user_data.get('avatar_url'),
            )
            pg_session.merge(user)
            migrated += 1
        except Exception as e:
            print(f"  ⚠️ User migration error: {e}")
    
    pg_session.commit()
    print(f"  ✅ Migrated {migrated} users")
    return migrated

async def migrate_wallets(mongo_db, pg_session):
    """Migrate wallets from MongoDB to PostgreSQL"""
    print("💰 Migrating wallets...")
    
    wallets = await mongo_db.wallets.find({}, {"_id": 0}).to_list(10000)
    migrated = 0
    
    for wallet_data in wallets:
        try:
            wallet = Wallet(
                id=wallet_data.get('id', str(wallet_data.get('_id', ''))),
                user_id=wallet_data.get('user_id', ''),
                coins=wallet_data.get('coins', 0),
                balance=wallet_data.get('balance', 0.0),
                total_earned=wallet_data.get('total_earned', 0),
                total_spent=wallet_data.get('total_spent', 0),
            )
            pg_session.merge(wallet)
            migrated += 1
        except Exception as e:
            print(f"  ⚠️ Wallet migration error: {e}")
    
    pg_session.commit()
    print(f"  ✅ Migrated {migrated} wallets")
    return migrated

async def migrate_games(mongo_db, pg_session):
    """Migrate games from MongoDB to PostgreSQL"""
    print("🎮 Migrating games...")
    
    games = await mongo_db.games.find({}, {"_id": 0}).to_list(1000)
    migrated = 0
    
    for game_data in games:
        try:
            game = Game(
                id=game_data.get('id', str(game_data.get('_id', ''))),
                name=game_data.get('name', ''),
                slug=game_data.get('slug', ''),
                category=game_data.get('category', 'arcade'),
                description=game_data.get('description'),
                thumbnail=game_data.get('thumbnail'),
                game_url=game_data.get('game_url'),
                min_score=game_data.get('min_score', 0),
                max_reward=game_data.get('max_reward', 100),
                cost_to_play=game_data.get('cost_to_play', 0),
                is_active=game_data.get('is_active', True),
                play_count=game_data.get('play_count', 0),
                total_score=game_data.get('total_score', 0),
            )
            pg_session.merge(game)
            migrated += 1
        except Exception as e:
            print(f"  ⚠️ Game migration error: {e}")
    
    pg_session.commit()
    print(f"  ✅ Migrated {migrated} games")
    return migrated

async def migrate_products(mongo_db, pg_session):
    """Migrate products from MongoDB to PostgreSQL"""
    print("📦 Migrating products...")
    
    products = await mongo_db.products.find({}, {"_id": 0}).to_list(10000)
    migrated = 0
    
    for product_data in products:
        try:
            product = Product(
                id=product_data.get('id', str(product_data.get('_id', ''))),
                name=product_data.get('name', ''),
                description=product_data.get('description'),
                category=product_data.get('category'),
                retail_price=product_data.get('retail_price', 0.0),
                image_url=product_data.get('image_url', product_data.get('image')),
                is_active=product_data.get('is_active', True),
                stock=product_data.get('stock', 0),
            )
            pg_session.merge(product)
            migrated += 1
        except Exception as e:
            print(f"  ⚠️ Product migration error: {e}")
    
    pg_session.commit()
    print(f"  ✅ Migrated {migrated} products")
    return migrated

async def migrate_auctions(mongo_db, pg_session):
    """Migrate auctions from MongoDB to PostgreSQL"""
    print("🔨 Migrating auctions...")
    
    auctions = await mongo_db.auctions.find({}, {"_id": 0}).to_list(10000)
    migrated = 0
    
    for auction_data in auctions:
        try:
            auction = Auction(
                id=auction_data.get('id', str(auction_data.get('_id', ''))),
                title=auction_data.get('title', ''),
                description=auction_data.get('description'),
                product_id=auction_data.get('product_id'),
                image_url=auction_data.get('image_url', auction_data.get('image')),
                start_price=auction_data.get('start_price', 0.0),
                current_price=auction_data.get('current_price', auction_data.get('current_bid', 0.0)),
                retail_price=auction_data.get('retail_price', 0.0),
                bid_increment=auction_data.get('bid_increment', 0.01),
                status=auction_data.get('status', 'pending'),
                winner_id=auction_data.get('winner_id'),
                last_bidder_id=auction_data.get('last_bidder_id'),
                last_bidder_name=auction_data.get('last_bidder_name', auction_data.get('last_bidder')),
                bid_count=auction_data.get('bid_count', auction_data.get('total_bids', 0)),
            )
            pg_session.merge(auction)
            migrated += 1
        except Exception as e:
            print(f"  ⚠️ Auction migration error: {e}")
    
    pg_session.commit()
    print(f"  ✅ Migrated {migrated} auctions")
    return migrated

async def migrate_game_scores(mongo_db, pg_session):
    """Migrate game scores from MongoDB to PostgreSQL"""
    print("🏆 Migrating game scores...")
    
    scores = await mongo_db.game_scores.find({}, {"_id": 0}).to_list(100000)
    migrated = 0
    
    for score_data in scores:
        try:
            score = GameScore(
                id=score_data.get('id', str(score_data.get('_id', ''))),
                user_id=score_data.get('user_id', ''),
                game_id=score_data.get('game_id', ''),
                score=score_data.get('score', 0),
                reward=score_data.get('reward', 0),
            )
            pg_session.merge(score)
            migrated += 1
        except Exception as e:
            print(f"  ⚠️ Score migration error: {e}")
    
    pg_session.commit()
    print(f"  ✅ Migrated {migrated} game scores")
    return migrated

async def run_migration():
    """Run the full migration"""
    print("=" * 50)
    print("🚀 BidBlitz MongoDB → PostgreSQL Migration")
    print("=" * 50)
    print()
    
    # Check configuration
    if not MONGO_URL:
        print("❌ MONGO_URL not set in .env")
        return
    
    if not DATABASE_URL:
        print("❌ DATABASE_URL not set in .env")
        return
    
    print(f"📊 MongoDB: {DB_NAME}")
    print(f"🐘 PostgreSQL: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'configured'}")
    print()
    
    # Connect to databases
    try:
        mongo_db = await get_mongo_db()
        pg_session, engine = get_sync_pg_session()
        
        # Create tables if not exist
        print("📐 Creating PostgreSQL tables...")
        Base.metadata.create_all(engine)
        print("  ✅ Tables created")
        print()
        
        # Run migrations
        stats = {}
        stats['users'] = await migrate_users(mongo_db, pg_session)
        stats['wallets'] = await migrate_wallets(mongo_db, pg_session)
        stats['games'] = await migrate_games(mongo_db, pg_session)
        stats['products'] = await migrate_products(mongo_db, pg_session)
        stats['auctions'] = await migrate_auctions(mongo_db, pg_session)
        stats['game_scores'] = await migrate_game_scores(mongo_db, pg_session)
        
        # Summary
        print()
        print("=" * 50)
        print("✅ Migration Complete!")
        print("=" * 50)
        print()
        for table, count in stats.items():
            print(f"  {table}: {count} records")
        print()
        print("Total records migrated:", sum(stats.values()))
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        pg_session.close()

if __name__ == "__main__":
    asyncio.run(run_migration())
