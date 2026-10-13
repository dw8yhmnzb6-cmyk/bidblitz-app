# BidBlitz Fuel – Multi-Network Gateway V1 (DEV only)

Status: **READ-ONLY foundation**, not a live fuel payment solution.
Branch: `work/fuel-multi-network-gateway-v1`. Existing backend remains FastAPI.

## Goal
1. Start in Germany through existing networks (PACE, CarPay-Diem, ryd), then selected European countries.
2. Reuse the same BidBlitz app/login, merchant/admin infrastructure and existing database.
3. Add Kosovo direct-station integrations later, but **do not** assume coverage or contracts.
4. Keep BidBlitz a technology/intermediary partner where contractually and legally appropriate; never accidentally become merchant of record or hold customer funds.

## Implemented now
- `backend/services/fuel_gateway.py`: typed read-only network gateway and neutral station identifier namespace.
- Supported network IDs: `pace`, `carpay_diem`, `ryd`, `kosovo_direct` (identifiers only, **not active integrations**).
- No station is returned without an explicit signed-contract flag, approved country, partner station-ID allowlist and enabled discovery.
- Upstream provider failures produce sanitized `provider_unavailable` status; other partners remain usable.
- No cross-provider deduplication of physical stations (overlaps are expected).
- All payment-authorization calls deliberately fail closed.
- `backend/tests/test_fuel_gateway_v1.py`: offline network isolation, restrictions, validation, payment blocking.

## Explicitly NOT implemented
- Credentials, contract approval, provider-specific URLs/authentication, live station inventories, fuel prices, transaction fees.
- End-to-end pay-at-pump authorization, capture, void, refunds or settlement.
- Customer UI, administration pages, production router registration or deployments.
- Realistic production/idempotency ledger: must use a durable storage design tied to the existing backend database, not process-local memory.
- Legal/PSP approval and Kosovo rollout. No claim of network availability.

## Network onboarding (independent per network)
- Commercial team obtains written app-embed/white-label and territory rights.
- Partner issues official documentation, a sandbox tenant and credentials.
- Confirm supported countries/stations/pumps and merchant-of-record / PSP.
- Confirm commission/fees and official receipt + customer-service responsibility.
- Add real provider adapter with retry policy for **safe reads only**; payment retries require an independent durable idempotency design.
- Contract/admin gate enables the permitted station ID set, per country.

## Payment architecture – next separate implementation
Customer -> BidBlitz UI -> selected network adapter -> partner/acquiring PSP -> petrol-station merchant.
BidBlitz receives a contractual referral/platform fee only where agreed.

Before enabling payment:
- Decide regulated payment roles, licensing, PSD2/SCA, PSD3 transition and VAT/invoicing with competent advisers; do not assume money routing alone determines VAT treatment.
- Use an immutable transaction reference, unique request key and atomic persisted state transitions.
- Define `CREATED`, `PENDING_AUTH`, `AUTHORIZED`, `DISPENSING`, `PENDING_SETTLEMENT`, `SETTLED`, `FAILED`, `UNKNOWN`, `MANUAL_REVIEW`.
- `UNKNOWN` = only read-only provider probe and reconciliation; **never** blindly re-authorize/capture or cancel.
- Validate signed webhooks, reconciliation files, refunds, partial fills, reversals and chargeback responsibilities.
- Treat offline/timeout as inconclusive unless proven otherwise; audits redact secrets and payment data.
- No fake live stations, prices, balances or completed payments.

## Release gates
1. Contract evidence + commercial terms documented per network.
2. Partner sandbox access and privacy/DPA/PSP compliance review.
3. Schema review (existing DB and BidBlitz ID), no second billing engine.
4. Integration contract tests, retry/failure-path tests, security review.
5. Controlled Germany pilot in sandbox; user-accepted real-money go-live separately.
6. Only then add other European networks/countries.
7. Kosovo: local pump/POS interfaces, acquiring bank/PSP, station agreements and local fiscal requirements.

## Local test (Python stdlib)
```bash
python -m unittest discover -s backend/tests -p test_fuel_gateway_v1.py -v
```

## Safety defaults
- No feature flag / API route is registered.
- No outbound network calls unless the application explicitly instantiates and configures an approved adapter.
- No real money operations in this module.
- Existing production app, routes and infrastructure are not modified by this branch.


## Core domain expansion (2026-10-13)
Added a provider-neutral DEV-only fuel domain in `backend/services/fuel_core.py`.

Implemented:
- normalized provider enum for simulator, PACE, Shell, DKV, UTA, Radius, Circle K, Eurowag, Logos, Moveyou, HUTH, Hectronic, DFS/Tokheim, OpenFSC, IFSF and direct stations;
- station capabilities so UI/API can expose only functions actually supported by a station;
- typed fuel products, pump records and pump status;
- deterministic simulator catalog for frontend/API development before partner credentials exist;
- commission rules for percentage, per-litre, per-transaction and hybrid contracts using Decimal arithmetic;
- fail-closed fuel-session state machine;
- UNKNOWN/TIMEOUT paths cannot resume financial execution automatically and can only move to manual review.

Still deliberately disabled:
- public Fuel routes;
- external provider calls;
- real payment authorization/capture/refund;
- production deployment;
- automatic settlement.

Verification:
`python3 -m unittest backend.tests.test_fuel_core_v1 backend.tests.test_fuel_gateway_v1 -v` -> 21/21 PASS.


## Operator settlement expansion (2026-10-13)
Added DEV-only operator finance and dashboard foundations.

Implemented:
- operator contract model with signed-contract gate;
- Merchant/Supplier-of-Record role fields;
- configurable fee ownership (operator, BidBlitz, shared);
- split-settlement allocation math without moving money;
- reconciliation model for POS vs PSP vs BidBlitz amounts;
- synthetic operator overview endpoint;
- Fuel operator dashboard route at `/operator/fuel`;
- operator metrics and station health remain simulator-only.

Safety:
- settlement remains calculation/reporting only;
- no PSP transfers, real payouts or merchant onboarding execution;
- no unsigned contract can enable settlement;
- real provider/payment execution is still blocked.

Verification:
- 27/27 pure Fuel core/gateway/finance tests PASS;
- Python compile PASS;
- JSX/JS parser checks PASS for Fuel pages, service and route file.


## DKV Enterprise API onboarding model (2026-10-13)
Added a fail-closed DKV Enterprise API capability model based on the written reply from DKV API Management.

Confirmed and encoded:
- REST/JSON Enterprise API;
- EUR 69.90/month API access offer;
- customer-specific onboarding and authorization;
- one BidBlitz software platform may serve multiple separately onboarded DKV customers;
- no separate public sandbox; production access follows onboarding;
- six confirmed data products: invoice, unsettled, consumption, online authorization, service card master data and toll product master data.

Deliberately NOT claimed/implemented:
- pay-at-pump API;
- station discovery/price API;
- revenue share;
- white-label fueling;
- split settlement.

A DKV tenant cannot become ACTIVE without production approval and technical-user configuration. Even an ACTIVE DEV tenant still cannot make outbound production calls because the client remains a blocking stub until official onboarding/credentials and integration review are complete.


## Fuel Control Center + receipt separation (2026-10-13)
Implemented additional DEV-only Fuel controls:
- Admin Fuel Control Center at `/admin/fuel`;
- provider capability/status overview including DKV confirmed vs unconfirmed capabilities;
- synthetic incident feed for offline/out-of-order simulator pumps;
- operator-issued fuel receipt model separated from BidBlitz platform earning records;
- 3-decimal unit-price precision for fuel receipts;
- explicit rule that V1 fuel receipts remain operator-issued, not BidBlitz-issued.

Verification:
- 35/35 Fuel core/gateway/finance/DKV/receipt tests PASS;
- Python compile PASS;
- JSX/JS parser checks PASS for Fuel pages/services/routes.

Still blocked by design:
- real PSP execution;
- external provider credentials/calls;
- fiscal receipt issuance;
- live operator settlement.
