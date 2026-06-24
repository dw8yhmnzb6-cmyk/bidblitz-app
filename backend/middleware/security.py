"""
Security Middleware & Best Practices
CORS, Rate Limiting, Security Headers
"""
from fastapi import Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict
from time import time
import os

# Rate Limiting Storage (in-memory, use Redis in production)
rate_limit_storage = defaultdict(list)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Security Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # CSP (Content Security Policy)
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://api.mapbox.com; "
            "style-src 'self' 'unsafe-inline' https://api.mapbox.com; "
            "img-src 'self' data: https: blob:; "
            "font-src 'self' data:; "
            "connect-src 'self' https://api.stripe.com https://api.mapbox.com; "
            "frame-src https://js.stripe.com; "
        )
        response.headers["Content-Security-Policy"] = csp
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple rate limiting middleware."""
    
    def __init__(self, app, max_requests: int = 100, window: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window = window
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limit for health checks
        if request.url.path == "/api/monitoring/health":
            return await call_next(request)
        
        ip = request.client.host if request.client else "unknown"
        now = time()
        
        # Get requests from this IP
        requests = rate_limit_storage[ip]
        
        # Remove old requests outside window
        requests = [req_time for req_time in requests if now - req_time < self.window]
        rate_limit_storage[ip] = requests
        
        # Check limit
        if len(requests) >= self.max_requests:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Max {self.max_requests} requests per {self.window}s"
            )
        
        # Add current request
        requests.append(now)
        
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(self.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(max(0, self.max_requests - len(requests)))
        response.headers["X-RateLimit-Reset"] = str(int(now + self.window))
        
        return response


def configure_cors(app):
    """Configure CORS middleware."""
    origins = [
        "http://localhost:3000",
        "https://commerce-hub-565.preview.emergentagent.com",
        os.getenv("REACT_APP_BACKEND_URL", ""),
    ]
    
    # Remove empty strings
    origins = [o for o in origins if o]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    )


def configure_security(app):
    """Configure all security middleware."""
    # Add security headers
    app.add_middleware(SecurityHeadersMiddleware)
    
    # Add rate limiting (100 req/min per IP)
    app.add_middleware(RateLimitMiddleware, max_requests=100, window=60)
    
    # Configure CORS
    configure_cors(app)


# ═══════════════════════════════════════════════════════════
# INPUT VALIDATION HELPERS
# ═══════════════════════════════════════════════════════════
import re

def validate_email(email: str) -> bool:
    """Validate email format."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def sanitize_string(text: str, max_length: int = 1000) -> str:
    """Sanitize user input."""
    # Remove null bytes
    text = text.replace('\x00', '')
    
    # Limit length
    text = text[:max_length]
    
    # Strip leading/trailing whitespace
    text = text.strip()
    
    return text


def validate_phone(phone: str) -> bool:
    """Validate phone number (basic)."""
    # Remove common separators
    phone = re.sub(r'[\s\-\(\)\+]', '', phone)
    
    # Check if only digits remain and reasonable length
    return phone.isdigit() and 7 <= len(phone) <= 15
