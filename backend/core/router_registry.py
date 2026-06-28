"""
Router Registry - Auto-discover and register all route modules
Simplifies server.py by auto-importing all routers from /routes
"""

import logging
import traceback
from pathlib import Path

logger = logging.getLogger("bidblitz.registry")

# Module-level state for diagnostic introspection
REGISTRATION_STATE = {
    "registered": [],   # list of dicts: {module, attr, prefix, route_count}
    "failed": [],       # list of dicts: {module, attr, error_type, error}
    "total_registered": 0,
    "total_failed": 0,
}


def get_registration_state() -> dict:
    """Read-only access to the latest router registration state."""
    return REGISTRATION_STATE


def register_all_routers(app):
    """
    Dynamically import and register all routers from /routes directory.
    Replaces 90+ manual import/register statements.
    """
    
    # Manual registry for routes with special naming or multiple routers
    # Format: (module_path, router_attribute_name)
    routers = [
        # Core
        ("routes.auth", "router"),
        ("routes.wallet", "router"),
        ("routes.payment", "router"),
        ("routes.merchant", "router"),
        ("routes.transactions", "router"),
        ("routes.stripe", "router"),
        ("routes.payout", "router"),
        ("routes.admin", "router"),
        ("routes.monitoring", "router"),
        ("routes.diag", "router"),
        ("routes.merchant_admin", "router"),
        ("routes.merchant_portal", "router"),
        ("routes.blitz_transfer", "router"),
        ("routes.smm_boost", "router"),
        ("routes.export", "router"),
        ("routes.profile", "router"),
        ("routes.sessions", "router"),
        ("routes.referral", "router"),
        ("routes.notifications", "router"),
        ("routes.promotions", "router"),
        ("routes.analytics", "router"),
        ("routes.kids", "router"),
        ("routes.kids_controls", "router"),
        ("routes.kids_app", "router"),
        ("routes.support", "router"),
        ("routes.feedback", "router"),
        ("routes.auctions", "router"),
        ("routes.express_checkout", "router"),  # New: 1-Klick Checkout
        ("routes.express_checkout_stripe", "router"),  # Stripe Integration
        ("routes.merchant_connect", "router"),
        ("routes.influencer", "router"),
        ("routes.investor", "router"),
        ("routes.rewards", "router"),
        ("routes.move_earn", "router"),
        ("routes.role_requests", "router"),
        ("routes.verification", "router"),
        ("routes.merchant_hierarchy", "router"),
        
        # POS System (14 modules)
        ("routes.pos_payments", "router"),
        ("routes.pos_system", "router"),
        ("routes.pos_inventory", "router"),
        ("routes.pos_chat", "router"),
        ("routes.pos_admin_self", "router"),
        ("routes.pos_extended", "router"),
        ("routes.pos_extended_cash", "router"),
        ("routes.pos_advanced", "router"),
        ("routes.pos_pro", "router"),
        ("routes.pos_vouchers", "router"),
        ("routes.pos_security", "router"),
        ("routes.pos_kassenmeldung", "router"),
        ("routes.pos_rksv", "router"),
        ("routes.pos_features", "router"),
        ("routes.pos_public_api", "router"),
        ("routes.pos_selfcheckout", "router"),
        ("routes.qr_table_order", "router"),
        ("routes.qr_table_order", "admin_router"),
        ("routes.restaurant_table_system", "router"),
        ("routes.pos_retail_p1p2", "router"),
        ("routes.pos_hardware", "router"),
        
        # Staff Management
        ("routes.staff", "router"),
        ("routes.staff_extended", "router"),
        ("routes.staff_geofence", "router"),  # New: Urlaub + GPS
        ("routes.staff_chat", "router"),  # 1:1 Manager↔Staff Chat MVP
        ("routes.staff_reminders", "router"),  # Smart Reminder Engine
        ("routes.staff_open_shifts", "router"),  # Schichttausch (Open Shifts) MVP
        ("routes.staff_offline_sync", "router"),  # Offline Clock Event Sync Queue
        ("routes.staff_live_map", "router"),  # Manager Live-Map + Anomaly Inbox (iter121)
        ("routes.staff_shift_watchdog", "router"),  # Push-Reminder Watchdog (iter121)
        ("routes.staff_heatmap", "router"),  # Shift-Heatmap (iter122)
        ("routes.staff_shift_assistant", "router"),  # AI-Schichtplan-Assistent (P3)
        ("routes.taxi_admin_promos", "router"),  # Taxi Promo Code Admin/Reporting
        ("routes.taxi_scheduled", "router"),  # Pre-Booking + Recurring (iter123)
        ("routes.taxi_corporate", "router"),  # B2B Corporate Accounts (iter123)
        ("routes.taxi_driver_pro", "router"),  # Driver Heatmap/Documents/Earnings (iter123)
        ("routes.taxi_lostfound", "router"),  # Lost & Found (iter123)
        ("routes.taxi_tariffs", "router"),  # Multi-Tariff + Airport Queue + Public Demand (iter123)
        ("routes.staff_multi_merchant", "router"),
        ("routes.staff_subscription", "router"),
        ("routes.staff_settings", "router"),
        ("routes.staff_manager", "router"),
        ("routes.staff_export", "router"),
        ("routes.staff_templates", "router"),
        ("routes.staff_roles", "router"),
        ("routes.staff_locations", "router"),
        ("routes.staff_warnings", "router"),
        ("routes.staff_reports_extended", "router"),
        ("routes.staff_magic_link", "router"),
        ("routes.staff_invites", "router"),
        ("routes.staff_profile", "router"),
        ("routes.staff_metrics", "router"),
        ("routes.staff_notifications", "router"),
        ("routes.staff_insights", "router"),
        ("routes.staff_alerts", "router"),
        ("routes.staff_analytics", "router"),
        ("routes.staff_demo", "router"),
        ("routes.staff_system", "router"),
        ("routes.staff_stripe", "router"),
        ("routes.staff_stripe", "webhook_router"),
        ("routes.staff_wallet", "router"),
        ("routes.staff_push", "router"),
        ("routes.staff_timesheet", "router"),
        ("routes.staff_tasks", "router"),
        ("routes.staff_checklists", "router"),
        ("routes.staff_training", "router"),
        ("routes.staff_knowledge", "router"),
        ("routes.staff_connect", "router"),
        
        # Mining & Marketplace
        ("routes.mining", "router"),
        ("routes.mining_phase2", "router"),
        ("routes.blitz_mine", "router"),
        ("routes.marketplace", "router"),
        ("routes.commerce_center", "router"),
        
        # Communication
        ("routes.chat", "router"),
        ("routes.applications", "router"),
        
        # Systems
        ("routes.referral_system", "router"),
        ("routes.kids_system", "router"),
        ("routes.subscription_system", "router"),
        ("routes.growth_engine", "router"),
        ("routes.boost_system", "router"),
        ("routes.loyalty_system", "router"),
        ("routes.rewards_store", "router"),
        
        # Finance
        ("routes.p2p", "router"),
        ("routes.p2p_transfer", "router"),
        ("routes.split_bill", "router"),
        ("routes.invoicing", "router"),
        ("routes.invoicing", "public_router"),
        ("routes.invoicing", "webhook_router"),
        ("routes.virtual_cards", "router"),
        ("routes.credit_system", "router"),
        ("routes.bills", "router"),
        ("routes.receipts", "router"),
        ("routes.admin_wallet", "router"),
        ("routes.coinbase_commerce", "router"),
        ("routes.pay_sdk", "router"),  # BidBlitz Pay SDK for 3rd-party websites
        
        # Entertainment
        ("routes.gaming", "router"),
        ("routes.casino", "router"),
        ("routes.arcade", "router"),
        ("routes.nft_generator", "router"),
        
        # Business
        ("routes.legal", "router"),
        ("routes.legal", "admin_router"),  # Special case: legal has 2 routers
        ("routes.admin_management", "router"),
        ("routes.revenue", "router"),
        ("routes.revenue2", "router"),
        ("routes.merchant_payments", "router"),
        ("routes.executive_center", "router"),
        
        # Engagement
        ("routes.reengage", "router"),
        ("routes.growth", "router"),
        ("routes.quests", "router"),
        ("routes.retention", "router"),
        ("routes.gamification", "router"),
        ("routes.extras", "router"),
        
        # Social
        ("routes.friends_map", "router"),
        ("routes.friends", "router"),
        ("routes.web_push", "router"),
        ("routes.push_notifications", "router"),
        ("routes.push_notifications", "admin_router"),
        
        # Mobility
        ("routes.taxi", "router"),
        ("routes.taxi_admin", "router"),
        ("routes.taxi_voiceover", "router"),  # ElevenLabs Voiceover
        ("routes.driver_dashboard", "router"),
        ("routes.mobility_platform", "router"),
        ("routes.mobility_payments", "router"),
        ("routes.scooter", "router"),
        ("routes.food", "router"),
        ("routes.food_tracking", "router"),
        ("routes.tierbetreuung", "router"),
        ("routes.ev_charging", "router"),
        
        # Support
        ("routes.kyc", "router"),
        ("routes.support_tickets", "router"),
        ("routes.two_factor", "router"),
        ("routes.admin_approvals", "router"),
        
        # Crypto
        ("routes.crypto_wallet", "router"),
        ("routes.crypto_prices", "router"),
        
        # Special routers
        ("routes.auction_push", "router"),
        ("routes.super_app_features", "router"),
        ("routes.livekit_streaming", "router"),
        ("routes.live_shopping", "router"),
        ("routes.live_auctions", "router"),
        ("routes.landing_chatbot", "router"),
        ("routes.readiness", "router"),
        ("routes.scan_router", "router"),

        # Travel & Booking (Hotels, Flights, Apartments, Restaurants)
        ("routes.hotels", "router"),
        ("routes.sabre", "router"),
        ("routes.bookings", "router"),
        ("routes.bookings", "admin_router"),
        ("routes.apartments", "router"),
        ("routes.flights", "router"),
        ("routes.restaurants", "router"),
    ]
    
    # Register all routers
    registered = 0
    failed = []
    REGISTRATION_STATE["registered"] = []
    REGISTRATION_STATE["failed"] = []
    
    for module_path, router_attr in routers:
        try:
            # Dynamic import
            module = __import__(module_path, fromlist=[router_attr])
            router = getattr(module, router_attr)
            
            # Register router
            app.include_router(router)
            registered += 1
            REGISTRATION_STATE["registered"].append({
                "module": module_path,
                "attr": router_attr,
                "prefix": getattr(router, "prefix", ""),
                "route_count": len(getattr(router, "routes", []) or []),
            })
            
        except ImportError as e:
            logger.error(f"❌ Could not import {module_path}.{router_attr}: {e}", exc_info=True)
            failed.append(module_path)
            REGISTRATION_STATE["failed"].append({
                "module": module_path, "attr": router_attr,
                "error_type": "ImportError", "error": str(e),
                "traceback": traceback.format_exc(),
            })
        except AttributeError as e:
            logger.warning(f"Router '{router_attr}' not found in {module_path}: {e}")
            failed.append(module_path)
            REGISTRATION_STATE["failed"].append({
                "module": module_path, "attr": router_attr,
                "error_type": "AttributeError", "error": str(e),
                "traceback": traceback.format_exc(),
            })
        except SyntaxError as e:
            logger.error(f"❌ SYNTAX ERROR in {module_path}: {e}", exc_info=True)
            failed.append(module_path)
            REGISTRATION_STATE["failed"].append({
                "module": module_path, "attr": router_attr,
                "error_type": "SyntaxError", "error": str(e),
                "traceback": traceback.format_exc(),
            })
        except Exception as e:
            logger.error(f"❌ Failed to register {module_path}.{router_attr}: {e}", exc_info=True)
            failed.append(module_path)
            REGISTRATION_STATE["failed"].append({
                "module": module_path, "attr": router_attr,
                "error_type": type(e).__name__, "error": str(e),
                "traceback": traceback.format_exc(),
            })
    
    REGISTRATION_STATE["total_registered"] = registered
    REGISTRATION_STATE["total_failed"] = len(failed)
    
    logger.info(f"✓ Registered {registered} routers")
    if failed:
        logger.warning(f"⚠ Failed to register {len(failed)} routers: {', '.join(failed[:5])}")
    
    return registered, failed
