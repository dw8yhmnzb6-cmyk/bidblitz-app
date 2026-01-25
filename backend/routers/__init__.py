# Routers Package
from routers.auth import router as auth_router
from routers.products import router as products_router
from routers.auctions import router as auctions_router
from routers.checkout import router as checkout_router
from routers.admin import router as admin_router
from routers.affiliate import router as affiliate_router
from routers.user import router as user_router
from routers.bots import router as bots_router
from routers.vouchers import router as vouchers_router
from routers.wholesale import router as wholesale_router

__all__ = [
    "auth_router",
    "products_router", 
    "auctions_router",
    "checkout_router",
    "admin_router",
    "affiliate_router",
    "user_router",
    "bots_router",
    "vouchers_router",
    "wholesale_router"
]
