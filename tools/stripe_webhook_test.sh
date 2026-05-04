#!/usr/bin/env bash
#
# BidBlitz — Stripe CLI Webhook Test
#
# This script forwards Stripe events to your local backend via Stripe-CLI's
# webhook listener. Use it to validate that:
#   1. /api/webhook/stripe receives events
#   2. checkout.session.completed correctly credits user.bid_credits
#   3. payment_transactions row is updated to 'credited'
#   4. Idempotency works (second call to same event = no double credit)
#
# PREREQUISITES:
#   - Install Stripe CLI: https://stripe.com/docs/stripe-cli
#     • macOS:  brew install stripe/stripe-cli/stripe
#     • Linux:  curl -L https://github.com/stripe/stripe-cli/releases/latest/download/stripe_X.X.X_linux_x86_64.tar.gz | tar -xz
#   - Login to Stripe: stripe login
#
# USAGE:
#   ./tools/stripe_webhook_test.sh start    # forwards events to local
#   ./tools/stripe_webhook_test.sh trigger  # sends a fake checkout.session.completed
#

set -e

API_URL="${API_URL:-http://localhost:8001}"
WEBHOOK_PATH="/api/webhook/stripe"

if [ -z "$1" ]; then
  echo "Usage: $0 [start|trigger|test-bid-credits|verify-creds]"
  exit 1
fi

case "$1" in
  start)
    echo "→ Forwarding Stripe events to $API_URL$WEBHOOK_PATH"
    echo "  Copy the 'whsec_...' shown below into backend/.env as STRIPE_WEBHOOK_SECRET"
    stripe listen --forward-to "$API_URL$WEBHOOK_PATH"
    ;;

  trigger)
    echo "→ Triggering a generic checkout.session.completed event"
    stripe trigger checkout.session.completed
    ;;

  test-bid-credits)
    echo "→ Triggering a checkout.session.completed event with bid_credits metadata"
    stripe trigger checkout.session.completed \
      --add 'checkout_session:metadata[type]=bid_credits' \
      --add 'checkout_session:metadata[user_id]=test_user_123' \
      --add 'checkout_session:metadata[credits]=25' \
      --add 'checkout_session:metadata[pending_id]=pending_test_xyz'
    ;;

  verify-creds)
    echo "→ Verifying user got bid_credits incremented (against MongoDB)"
    if ! command -v mongosh &> /dev/null; then
      echo "  Install mongosh first: https://www.mongodb.com/docs/mongodb-shell/install/"
      exit 1
    fi
    mongosh "$MONGO_URL" --eval '
      const user = db.users.findOne({email: "kyc.test@bidblitz-test.com"});
      print("User bid_credits:", user?.bid_credits || 0);
      print("Latest transactions:");
      db.transactions.find({type: "bid_credits_purchase"}).sort({created_at: -1}).limit(3).forEach(t => printjson({
        amount: t.amount, credits: t.credits, status: t.status, created_at: t.created_at
      }));
    '
    ;;

  *)
    echo "Unknown command: $1"
    echo "Usage: $0 [start|trigger|test-bid-credits|verify-creds]"
    exit 1
    ;;
esac
