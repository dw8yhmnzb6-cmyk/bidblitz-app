from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from core.config import MONGO_URL, DB_NAME

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


def sanitize_doc(doc):
    """Remove MongoDB _id from document and convert ObjectId fields to strings."""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [sanitize_doc(d) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if key == "_id":
                continue  # Skip _id entirely
            if isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, dict):
                result[key] = sanitize_doc(value)
            elif isinstance(value, list):
                result[key] = sanitize_doc(value)
            else:
                result[key] = value
        return result
    if isinstance(doc, ObjectId):
        return str(doc)
    return doc

async def create_indexes():
    """Create database indexes for optimal query performance.
    Uses drop_duplicates to handle existing index conflicts."""
    import logging
    logger = logging.getLogger("bidblitz.db")
    
    async def safe_create_index(collection, keys, **kwargs):
        """Safely create index, dropping conflicting ones if needed."""
        try:
            await collection.create_index(keys, **kwargs)
        except Exception as e:
            if "IndexKeySpecsConflict" in str(e) or "existing index" in str(e).lower():
                # Drop and recreate
                try:
                    index_name = kwargs.get("name")
                    if not index_name:
                        # Generate name from keys
                        if isinstance(keys, str):
                            index_name = f"{keys}_1"
                        elif isinstance(keys, list):
                            parts = [f"{k}_{v}" for k, v in keys]
                            index_name = "_".join(parts)
                    await collection.drop_index(index_name)
                    await collection.create_index(keys, **kwargs)
                except Exception:
                    pass  # Index might not exist or other issue
            else:
                logger.warning(f"Index creation warning: {e}")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CORE COLLECTIONS
    # ═══════════════════════════════════════════════════════════════════════════
    
    # Users - primary lookup by email
    await safe_create_index(db.users, "email", unique=True)
    await safe_create_index(db.users, "role")
    await safe_create_index(db.users, "referred_by")
    # P2P handle - unique, sparse (not all users claim one)
    await safe_create_index(db.users, "handle", unique=True, sparse=True)

    # Card applications (Revolut-style debit card waitlist)
    await safe_create_index(db.card_applications, "application_id", unique=True)
    await safe_create_index(db.card_applications, [("user_id", 1), ("status", 1)])
    await safe_create_index(db.card_applications, "status")

    # Live streams (Shopee/TikTok-Shop-style live shopping)
    await safe_create_index(db.live_streams, "stream_id", unique=True)
    await safe_create_index(db.live_streams, [("status", 1), ("viewer_count", -1)])
    await safe_create_index(db.live_streams, "host_user_id")

    # Gruppenchat (WeChat-style)
    await safe_create_index(db.chat_groups, "group_id", unique=True)
    await safe_create_index(db.chat_groups, [("member_ids", 1), ("last_message_at", -1)])
    await safe_create_index(db.chat_group_messages, "message_id", unique=True)
    await safe_create_index(db.chat_group_messages, [("group_id", 1), ("created_at", -1)])

    # Round-up Savings
    await safe_create_index(db.roundup_config, "user_id", unique=True)
    await safe_create_index(db.roundup_entries, [("user_id", 1), ("created_at", -1)])
    await safe_create_index(db.roundup_entries, [("user_id", 1), ("tx_id", 1)], unique=False)

    # Apartments Marketplace (Airbnb-clone)
    await safe_create_index(db.apartments, "apartment_id", unique=True)
    await safe_create_index(db.apartments, [("status", 1), ("city", 1)])
    await safe_create_index(db.apartments, "host_user_id")
    await safe_create_index(db.apartment_bookings, "booking_id", unique=True)
    await safe_create_index(db.apartment_bookings, [("guest_user_id", 1), ("booked_at", -1)])
    await safe_create_index(db.apartment_bookings, "host_user_id")
    
    # Login attempts - brute force protection
    await safe_create_index(db.login_attempts, "identifier")
    await safe_create_index(db.login_attempts, "locked_until")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # TRANSACTIONS - High volume, critical for performance
    # ═══════════════════════════════════════════════════════════════════════════
    
    # Primary query: user's transactions sorted by date
    await safe_create_index(db.transactions, [("user_id", 1), ("created_at", -1)])
    # Secondary query: filter by type/status
    await safe_create_index(db.transactions, [("user_id", 1), ("type", 1), ("created_at", -1)])
    await safe_create_index(db.transactions, [("user_id", 1), ("status", 1)])
    # Idempotency check (payment engine)
    await safe_create_index(db.transactions, "idempotency_key", sparse=True)
    
    # ═══════════════════════════════════════════════════════════════════════════
    # MERCHANTS
    # ═══════════════════════════════════════════════════════════════════════════
    
    await safe_create_index(db.merchants, "user_id", unique=True)
    await safe_create_index(db.merchants, "status")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # MARKETPLACE
    # ═══════════════════════════════════════════════════════════════════════════
    
    # Primary listing lookup
    await safe_create_index(db.marketplace_listings, "listing_id", unique=True)
    # Seller's listings
    await safe_create_index(db.marketplace_listings, [("seller_id", 1), ("created_at", -1)])
    # Browse listings by status + category
    await safe_create_index(db.marketplace_listings, [("status", 1), ("category", 1), ("created_at", -1)])
    # Search optimization
    await safe_create_index(db.marketplace_listings, [("status", 1), ("price", 1)])
    
    # Orders
    await safe_create_index(db.marketplace_orders, "order_id", unique=True)
    await safe_create_index(db.marketplace_orders, [("buyer_id", 1), ("created_at", -1)])
    await safe_create_index(db.marketplace_orders, [("seller_id", 1), ("created_at", -1)])
    
    # Messages
    await safe_create_index(db.marketplace_messages, [("recipient_id", 1), ("created_at", -1)])
    await safe_create_index(db.marketplace_messages, [("sender_id", 1), ("created_at", -1)])
    
    # Favorites
    await safe_create_index(db.marketplace_favorites, [("user_id", 1), ("listing_id", 1)], unique=True)
    
    # ═══════════════════════════════════════════════════════════════════════════
    # NOTIFICATIONS
    # ═══════════════════════════════════════════════════════════════════════════
    
    await safe_create_index(db.notifications, [("user_id", 1), ("created_at", -1)])
    await safe_create_index(db.notifications, [("user_id", 1), ("read", 1)])
    
    # ═══════════════════════════════════════════════════════════════════════════
    # AUCTIONS
    # ═══════════════════════════════════════════════════════════════════════════
    
    await safe_create_index(db.auctions, "auction_id", unique=True)
    await safe_create_index(db.auctions, [("status", 1), ("end_time", 1)])
    await safe_create_index(db.auction_bids, [("auction_id", 1), ("created_at", -1)])
    await safe_create_index(db.auction_bids, [("user_id", 1), ("created_at", -1)])
    
    # ═══════════════════════════════════════════════════════════════════════════
    # MINING
    # ═══════════════════════════════════════════════════════════════════════════
    
    await safe_create_index(db.mining_miners, "miner_id", unique=True)
    await safe_create_index(db.mining_miners, "user_id")
    await safe_create_index(db.mining_claims, [("user_id", 1), ("created_at", -1)])
    await safe_create_index(db.mining_referrals, "referrer_id")
    await safe_create_index(db.mining_referrals, "referee_id")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # KIDS SYSTEM
    # ═══════════════════════════════════════════════════════════════════════════
    
    await safe_create_index(db.kids_children, "child_id", unique=True)
    await safe_create_index(db.kids_children, "parent_id")
    await safe_create_index(db.kids_transactions, [("child_id", 1), ("created_at", -1)])
    await safe_create_index(db.kids_transactions, [("parent_id", 1), ("created_at", -1)])
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SUBSCRIPTIONS
    # ═══════════════════════════════════════════════════════════════════════════
    
    await safe_create_index(db.subscriptions, "user_id", unique=True)
    await safe_create_index(db.subscriptions, [("status", 1), ("expires_at", 1)])
    
    # ═══════════════════════════════════════════════════════════════════════════
    # MOBILITY (Taxi, Scooter, Food)
    # ═══════════════════════════════════════════════════════════════════════════
    
    await safe_create_index(db.taxi_rides, [("user_id", 1), ("created_at", -1)])
    await safe_create_index(db.taxi_rides, [("driver_id", 1), ("status", 1)])
    await safe_create_index(db.taxi_rides, "status")
    
    await safe_create_index(db.scooter_rides, [("user_id", 1), ("created_at", -1)])
    
    await safe_create_index(db.food_orders, [("user_id", 1), ("created_at", -1)])
    await safe_create_index(db.food_orders, [("restaurant_id", 1), ("status", 1)])
    
    # ═══════════════════════════════════════════════════════════════════════════
    # AUDIT & ANALYTICS
    # ═══════════════════════════════════════════════════════════════════════════
    
    await safe_create_index(db.audit_log, [("user_id", 1), ("created_at", -1)])
    await safe_create_index(db.audit_log, [("action", 1), ("created_at", -1)])
    await safe_create_index(db.user_activity, [("user_id", 1), ("date", -1)])
    await safe_create_index(db.user_streaks, "user_id", unique=True)
    await safe_create_index(db.platform_revenue, "date", unique=True)
    
    # ═══════════════════════════════════════════════════════════════════════════
    # REFERRALS
    # ═══════════════════════════════════════════════════════════════════════════
    
    await safe_create_index(db.referral_codes, "code", unique=True)
    await safe_create_index(db.referral_codes, "user_id")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # SUPPORT & FEEDBACK
    # ═══════════════════════════════════════════════════════════════════════════
    
    await safe_create_index(db.support_tickets, [("user_id", 1), ("created_at", -1)])
    await safe_create_index(db.support_tickets, [("status", 1), ("created_at", -1)])
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PASSWORD RESETS
    # ═══════════════════════════════════════════════════════════════════════════
    
    await safe_create_index(db.password_resets, "token")
    await safe_create_index(db.password_resets, "email")
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PAYMENT TRANSACTIONS (Stripe)
    # ═══════════════════════════════════════════════════════════════════════════
    
    await safe_create_index(db.payment_transactions, "session_id", unique=True)
    await safe_create_index(db.payment_transactions, [("user_id", 1), ("created_at", -1)])
    
    # ═══════════════════════════════════════════════════════════════════════════
    # CAR RENTAL MODULE
    # ═══════════════════════════════════════════════════════════════════════════
    
    await safe_create_index(db.car_rental_vendors, "vendor_id", unique=True)
    await safe_create_index(db.car_rental_vendors, "user_id", unique=True)
    await safe_create_index(db.car_rental_vendors, "status")
    
    await safe_create_index(db.car_rental_cars, "car_id", unique=True)
    await safe_create_index(db.car_rental_cars, "vendor_id")
    await safe_create_index(db.car_rental_cars, [("status", 1), ("city", 1)])
    await safe_create_index(db.car_rental_cars, [("status", 1), ("price_per_day", 1)])
    
    await safe_create_index(db.car_rental_bookings, "booking_id", unique=True)
    await safe_create_index(db.car_rental_bookings, [("vendor_id", 1), ("created_at", -1)])
    await safe_create_index(db.car_rental_bookings, [("customer_id", 1), ("created_at", -1)])
    await safe_create_index(db.car_rental_bookings, [("car_id", 1), ("status", 1)])
    await safe_create_index(db.car_rental_bookings, [("status", 1), ("start_date", 1)])
    
    await safe_create_index(db.car_rental_invoices, "invoice_id", unique=True)
    await safe_create_index(db.car_rental_invoices, "invoice_number", unique=True)
    await safe_create_index(db.car_rental_invoices, [("vendor_id", 1), ("created_at", -1)])
    await safe_create_index(db.car_rental_invoices, "booking_id")
    
    await safe_create_index(db.car_rental_contracts, "contract_id", unique=True)
    await safe_create_index(db.car_rental_contracts, "booking_id")
    await safe_create_index(db.car_rental_contracts, [("vendor_id", 1), ("created_at", -1)])
    
    await safe_create_index(db.car_rental_damage_reports, "damage_id", unique=True)
    await safe_create_index(db.car_rental_damage_reports, [("vendor_id", 1), ("resolved", 1)])
    await safe_create_index(db.car_rental_damage_reports, "car_id")
    
    await safe_create_index(db.car_rental_payouts, "payout_id", unique=True)
    await safe_create_index(db.car_rental_payouts, [("vendor_id", 1), ("status", 1)])
    
    await safe_create_index(db.car_rental_vendor_staff, [("vendor_id", 1), ("user_id", 1)], unique=True)
    
    await safe_create_index(db.car_rental_customer_documents, [("customer_id", 1), ("doc_type", 1)])
    
    await safe_create_index(db.car_rental_activity_logs, [("vendor_id", 1), ("created_at", -1)])

    # ═══════════════════════════════════════════════════════════════════════════
    # V1 P0 WALLET / FEATURE CONTROL
    # ═══════════════════════════════════════════════════════════════════════════

    await safe_create_index(db.wallet_ledger_entries, "entry_id", unique=True)
    await safe_create_index(db.wallet_ledger_entries, [("transaction_id", 1), ("direction", 1)])
    await safe_create_index(db.wallet_ledger_entries, [("wallet_id", 1), ("created_at", -1)])
    await safe_create_index(db.wallet_ledger_entries, "idempotency_key")

    await safe_create_index(db.payment_idempotency, "idempotency_key", unique=True)
    await safe_create_index(db.payment_idempotency, [("user_id", 1), ("created_at", -1)])
    await safe_create_index(db.payment_idempotency, "expires_at")

    await safe_create_index(db.feature_flags, "key", unique=True)
    await safe_create_index(db.feature_flags, "parent_key")
    await safe_create_index(db.feature_flags, [("type", 1), ("status", 1)])
    await safe_create_index(db.feature_flag_audit, [("key", 1), ("changed_at", -1)])

    await safe_create_index(db.merchant_setup_progress, "merchant_id", unique=True)
    await safe_create_index(db.merchant_setup_progress, [("current_step", 1), ("updated_at", -1)])
    await safe_create_index(db.onboarding_test_sales, [("merchant_id", 1), ("created_at", -1)])

    await safe_create_index(db.merchant_settlements, "settlement_id", unique=True)
    await safe_create_index(db.merchant_settlements, [("merchant_id", 1), ("created_at", -1)])
    await safe_create_index(db.merchant_settlements, [("merchant_id", 1), ("status", 1), ("period_start", -1)])
    await safe_create_index(db.merchant_payouts, "payout_id", unique=True)
    await safe_create_index(db.merchant_payouts, [("merchant_id", 1), ("status", 1), ("created_at", -1)])
    await safe_create_index(db.merchant_balance_entries, "entry_id", unique=True)
    await safe_create_index(db.merchant_balance_entries, [("merchant_id", 1), ("status", 1), ("created_at", -1)])
    await safe_create_index(db.merchant_balance_entries, [("merchant_id", 1), ("transaction_id", 1), ("type", 1)], unique=True)
    await safe_create_index(db.merchant_fee_rules, "rule_id", unique=True, sparse=True)
    await safe_create_index(db.merchant_fee_rules, [("enabled", 1), ("priority", -1), ("valid_from", 1)])
    await safe_create_index(db.merchant_reserves, "reserve_id", unique=True)
    await safe_create_index(db.merchant_reserves, [("merchant_id", 1), ("mode", 1), ("status", 1)])
    await safe_create_index(db.merchant_adjustments, "adjustment_id", unique=True)
    await safe_create_index(db.merchant_adjustments, [("merchant_id", 1), ("status", 1), ("created_at", -1)])
    await safe_create_index(db.merchant_adjustments, [("merchant_id", 1), ("idempotency_key", 1)], unique=True)
    await safe_create_index(db.merchant_disputes, "dispute_id", unique=True)
    await safe_create_index(db.merchant_disputes, [("merchant_id", 1), ("status", 1), ("created_at", -1)])
    await safe_create_index(db.merchant_disputes, [("merchant_id", 1), ("idempotency_key", 1)], unique=True)
    await safe_create_index(db.merchant_balance_state, "merchant_id", unique=True)
    await safe_create_index(db.merchant_settlement_idempotency, [("scope", 1), ("merchant_id", 1), ("idempotency_key", 1)], unique=True)
    await safe_create_index(db.merchant_daily_closing_reports, "report_number", unique=True)
    await safe_create_index(db.merchant_z_reports, "report_number", unique=True)
    
    logger.info("Database indexes created/verified")

async def close_connection():
    client.close()
