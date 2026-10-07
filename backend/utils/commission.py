"""Canonical BidBlitz Taxi fare split.

Customer ride fares settle 80% to the assigned driver and 20% to BidBlitz.
Keep fare calculators and zone/time adjustments on this single source.
"""

DRIVER_COMMISSION = 0.80
PLATFORM_COMMISSION = 0.20
