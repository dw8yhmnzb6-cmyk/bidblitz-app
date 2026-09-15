# BidBlitz Power

Target: `power.bidblitz.ae`

BidBlitz Power is a mobile-first shared power-bank web product. It uses BidBlitz payment/auth capabilities through explicit integration boundaries; rental, hardware, pricing, inventory and operations stay separate domains.

## Customer flow

1. Find/scan station.
2. Resolve and show the exact station tariff before commitment.
3. Continue as guest or sign in to BidBlitz.
4. Authorize payment.
5. Request hardware release.
6. Start billing only after confirmed release.
7. Show a live browser rental session and compatible return stations.
8. End rental on confirmed hardware return timestamp.
9. Capture the final rental charge and release unused authorization.
10. Show receipt/support.

Public marketing may say `from EUR 0.50 / 30 min`; the checkout must always show the authoritative location/station price. A configurable temporary authorization (initial proposal EUR 20) is separate from the rental charge.

## Rental state machine

`CREATED -> PRICE_ACCEPTED -> PAYMENT_AUTHORIZED -> RELEASE_REQUESTED -> RELEASED -> ACTIVE -> RETURNED -> PAYMENT_CAPTURED -> COMPLETED`

Exceptional events/states include `RELEASE_FAILED`, `PAYMENT_FAILED`, `OVERDUE`, `LOST`, `DISPUTED`, `REFUNDED`. Transitions must be idempotent and auditable.

## Network hierarchy

Global -> Country -> City/Region -> Location -> Station -> Slot -> Power bank.

Pricing can inherit down the hierarchy with an explicit station override. Every rental stores an immutable pricing snapshot so later price changes never alter an active rental.

## Admin domains

- Global network/map
- Locations/stations/slots
- Power-bank inventory and lifecycle
- Pricing and price history
- Rentals
- Payment authorizations/captures/refunds
- Partners and settlements
- Sales/referrals
- Operations/rebalancing
- Inventory/logistics
- Maintenance/support/alerts
- Analytics/profitability
- Roles/permissions/audit log

## Hardware boundary

Manufacturer integration sits behind a hardware gateway. Hardware events are normalized into station, slot, release, return and health events. Manufacturer systems do not receive card data or partner-finance access.

## Safety rule

Stopping new rentals must never prevent an existing customer from returning a power bank.

## Delivery rule

Do not duplicate existing BidBlitz payment/auth code. Inspect current implementations and add a narrow integration contract. Do not merge this branch or deploy unfinished Power functionality to production without explicit approval.
