"""
BidBlitz V2 - Car Rental Module
Multi-vendor car rental system with full booking, contract, and invoice management.
"""

from .routes import router as car_rental_router

__all__ = ["car_rental_router"]
