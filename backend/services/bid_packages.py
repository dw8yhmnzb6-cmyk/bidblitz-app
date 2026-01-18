"""Bid packages and affiliate commission configuration"""
from models.schemas import BidPackage

# Fixed bid packages (€0.50 per bid average)
BID_PACKAGES = {
    "pack_5": BidPackage(id="pack_5", name="5 € Paket", bids=10, price=5.00, bonus_bids=0),
    "pack_10": BidPackage(id="pack_10", name="10 € Paket", bids=22, price=10.00, bonus_bids=2),
    "pack_15": BidPackage(id="pack_15", name="15 € Paket", bids=35, price=15.00, bonus_bids=5),
    "pack_25": BidPackage(id="pack_25", name="25 € Paket", bids=60, price=25.00, popular=True, bonus_bids=10),
    "pack_50": BidPackage(id="pack_50", name="50 € Paket", bids=130, price=50.00, bonus_bids=30),
    "pack_75": BidPackage(id="pack_75", name="75 € Paket", bids=200, price=75.00, bonus_bids=50),
    "pack_100": BidPackage(id="pack_100", name="100 € Paket", bids=280, price=100.00, bonus_bids=80),
    "pack_150": BidPackage(id="pack_150", name="150 € Paket", bids=450, price=150.00, bonus_bids=150),
}

# Affiliate Commission Structure (per lead/month)
AFFILIATE_COMMISSIONS = {
    "tier1": {"min_leads": 1, "max_leads": 5, "commission": 3.00},
    "tier2": {"min_leads": 6, "max_leads": 20, "commission": 5.00},
    "tier3": {"min_leads": 21, "max_leads": 50, "commission": 7.00},
    "tier4": {"min_leads": 51, "max_leads": float('inf'), "commission": 9.00},
}

AFFILIATE_BASE_COMMISSION = 8.00  # Minimum €8 per lead who buys
