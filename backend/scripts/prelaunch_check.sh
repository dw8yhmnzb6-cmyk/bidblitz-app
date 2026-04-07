#!/bin/bash
# BidBlitz V2 - Production Deployment Checklist
# Run this script before going live

echo "=================================================="
echo "BidBlitz V2 - Pre-Launch Checklist"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}!${NC} $1"
}

# 1. Environment Variables
echo "1. Environment Variables"
echo "------------------------"

if [ -n "$JWT_SECRET" ] && [ ${#JWT_SECRET} -ge 32 ]; then
    check_pass "JWT_SECRET is set (${#JWT_SECRET} chars)"
else
    check_fail "JWT_SECRET missing or too short"
fi

if [ -n "$MONGO_URL" ]; then
    check_pass "MONGO_URL is set"
else
    check_fail "MONGO_URL missing"
fi

if [ -n "$STRIPE_API_KEY" ]; then
    if [[ "$STRIPE_API_KEY" == sk_live_* ]]; then
        check_pass "STRIPE_API_KEY is LIVE key"
    else
        check_warn "STRIPE_API_KEY is TEST key - switch to live for production"
    fi
else
    check_fail "STRIPE_API_KEY missing"
fi

if [ "$APP_ENV" == "production" ]; then
    check_pass "APP_ENV is production"
else
    check_warn "APP_ENV is '$APP_ENV' - set to 'production' for go-live"
fi

echo ""

# 2. Security
echo "2. Security Settings"
echo "--------------------"

if [ "$COOKIE_SECURE" == "true" ]; then
    check_pass "COOKIE_SECURE enabled"
else
    check_warn "COOKIE_SECURE disabled - enable for HTTPS"
fi

if [ -n "$ADMIN_PASSWORD" ] && [ ${#ADMIN_PASSWORD} -ge 12 ]; then
    check_pass "ADMIN_PASSWORD is strong"
else
    check_warn "ADMIN_PASSWORD may be weak"
fi

echo ""

# 3. Database
echo "3. Database"
echo "-----------"

# Test MongoDB connection
if python3 -c "from pymongo import MongoClient; MongoClient('$MONGO_URL').server_info()" 2>/dev/null; then
    check_pass "MongoDB connection successful"
else
    check_fail "MongoDB connection failed"
fi

echo ""

# 4. Services
echo "4. Services Status"
echo "------------------"

if pgrep -f "uvicorn" > /dev/null; then
    check_pass "Backend server running"
else
    check_warn "Backend server not detected"
fi

if pgrep -f "react-scripts\|node" > /dev/null; then
    check_pass "Frontend server running"
else
    check_warn "Frontend server not detected"
fi

echo ""

# 5. API Health
echo "5. API Health Check"
echo "-------------------"

BACKEND_URL=${REACT_APP_BACKEND_URL:-"http://localhost:8001"}
if curl -s "${BACKEND_URL}/api/auth/health" | grep -q "ok\|healthy"; then
    check_pass "API health endpoint responding"
else
    check_warn "API health check inconclusive"
fi

echo ""

# Summary
echo "=================================================="
echo "Pre-Launch Checklist Complete"
echo ""
echo "Before going live:"
echo "  1. Switch STRIPE_API_KEY to sk_live_xxx"
echo "  2. Set APP_ENV=production"
echo "  3. Enable COOKIE_SECURE=true"
echo "  4. Run database backup: mongodump"
echo "  5. Test Stripe webhook endpoint"
echo "  6. Verify SSL/HTTPS on domain"
echo "=================================================="
