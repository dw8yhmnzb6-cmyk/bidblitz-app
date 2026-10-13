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


## End-to-end simulator session flow (2026-10-13)
Added a synthetic DEV-only end-to-end fueling flow:
- create session from approved simulator station/pump/fuel product;
- simulated authorization step (no PSP/network I/O);
- simulated fueling state;
- deterministic completion using demo litres;
- closed session with history;
- non-fiscal operator receipt generation;
- frontend session flow at `/fuel/simulator/{session_id}`;
- Fuel landing now enters the simulator flow instead of pretending to launch BidBlitz Pay.

Safety invariants:
- `real_payment_executed=false` throughout;
- `real_pump_released=false` throughout;
- simulator data is process-local and DEV-only;
- no production persistence, PSP call or provider command;
- receipt remains explicitly non-fiscal and operator-issued.

Verification:
- 39/39 Fuel tests PASS;
- Python compile PASS;
- JSX/JS parser checks PASS for all Fuel pages/services/routes.


## Provider onboarding + BidBlitz Pay bridge preparation (2026-10-13)
Implemented:
- provider onboarding matrix for DKV, PACE, Shell, UTA, Radius, Circle K, Eurowag, Logos, Moveyou, HUTH, Hectronic and DFS/Tokheim;
- explicit capability flags for API, station discovery, fueling, payment, revenue share, split settlement, sandbox, contract and credentials;
- fail-closed discovery/fueling readiness calculation;
- Fuel Payment Release Gates for provider contract, provider payment approval, PSP approval, split settlement, merchant role, reconciliation and verified webhooks;
- deterministic Fuel payment idempotency keys;
- Fuel-scoped BidBlitz Pay request builder (no execution);
- canonical durable Fuel session document shape for the existing BidBlitz Mongo database;
- required unique indexes for session ID and idempotency;
- optimistic-locking version contract;
- Admin Fuel Control Center now shows provider onboarding and missing payment release gates.

Safety:
- no live BidBlitz Pay call is executed;
- no provider can be marked Fueling READY without every required gate;
- DKV remains data-API confirmed only, with fueling/revenue-share/split-settlement unconfirmed;
- no second database introduced.

Verification:
- 48/48 Fuel tests PASS;
- Python compile PASS;
- Fuel admin/service JS parse PASS.


## Persistent repository + DKV read scaffold + provider detail (2026-10-13)
Implemented:
- FuelRepository for the existing BidBlitz Mongo database;
- idempotent insert, optimistic locking and station-history reads;
- no second database introduced;
- DKV read-adapter scaffold with request planning and structural response normalization;
- DKV execution remains blocked until official onboarding, credentials and endpoint documentation are configured;
- secret-like query parameters are rejected;
- provider onboarding detail endpoint;
- Admin provider detail page showing capability, contract, credential and readiness flags;
- Admin onboarding matrix rows link to provider details.

Verification:
- 58/58 Fuel tests PASS;
- Python compile PASS;
- Admin Fuel JS/JSX parse PASS.

Still intentionally disabled:
- outbound DKV production calls;
- real PSP execution;
- real pump release;
- live provider discovery without contract/credentials.


## Existing-DB persistence + provider contract model (2026-10-13)
Implemented:
- opt-in DEV persistence bridge for simulator sessions using the existing BidBlitz Mongo database;
- FUEL_DEV_PERSISTENCE=true explicitly enables simulator-session persistence; default remains OFF;
- simulator create/authorize/start/complete transitions can persist with optimistic locking;
- Fuel indexes added to the existing create_indexes() flow; no second database;
- provider contract model with territories, commercial terms, Merchant/Supplier of Record, fee ownership, white-label, API, payment, split-settlement and receipt-responsibility rights;
- unsigned provider contract templates stay blocked by default;
- provider detail page now displays the unsigned contract template;
- DKV read scaffold remains outbound-blocked until official credentials and endpoint documentation exist.

Verification:
- 64/64 Fuel tests PASS;
- Python compile PASS;
- Provider-detail/service JS/JSX parse PASS.

Safety:
- persistence does not enable payments;
- all provider contract defaults are unsigned/not ready;
- no real provider call, pump release or PSP execution is enabled.


## Admin contract storage + persisted session history (2026-10-13)
Implemented:
- admin-only Fuel contract configuration routes protected by existing BidBlitz admin auth;
- provider contract persistence in existing Mongo collection fuel_provider_contracts;
- sensitive key rejection: API keys, secrets, tokens and credentials cannot be stored in contract documents;
- admin read/list/save contract configuration;
- admin persisted Fuel-session history;
- admin-only DKV request-plan preview that performs zero outbound calls;
- Fuel Control Center now shows DEV persistence status and persisted session history;
- Provider Detail now shows stored contract configuration separately from the unsigned template.

Verification:
- 70/70 Fuel tests PASS;
- Python compile PASS;
- Fuel Admin JS/JSX parse PASS.

Safety:
- saving a contract config does not configure credentials;
- DKV request plan is preview-only;
- provider/payment execution remains fail-closed.


## Admin contract editor + operator history + reconciliation inbox (2026-10-13)
Implemented:
- admin Fuel provider contract editor with status, territories, rights and commercial terms;
- editor saves only non-secret contract configuration through admin-authenticated routes;
- operator dashboard simulator session history;
- Fuel reconciliation domain for POS/Forecourt vs PSP vs BidBlitz amount comparison;
- reconciliation severity and manual-review inbox;
- admin reconciliation API and Control Center inbox;
- database indexes for Fuel reconciliation cases.

Safety:
- contract editing still does not enable credentials or live execution;
- reconciliation never auto-corrects money;
- operator history remains simulator-only;
- real PSP/provider/pump execution stays fail-closed.

Verification:
- 73/73 Fuel tests PASS;
- Python compile PASS;
- Fuel Admin/Operator JS/JSX parse PASS.


## Reconciliation workflow + DKV request preview (2026-10-13)
Implemented:
- reconciliation case detail page;
- admin-only status transitions: OPEN -> REVIEWING/RESOLVED/IGNORED, REVIEWING -> RESOLVED/IGNORED;
- terminal reconciliation states are final;
- reconciliation notes and audit actor tracking;
- financial correction remains explicitly false for status updates;
- clickable reconciliation inbox in Fuel Control Center;
- DKV Enterprise API request-plan preview page for the six confirmed datasets;
- DKV preview requires customer onboarding flags before a plan can be produced;
- no outbound DKV execution is performed.

Verification:
- 76/76 Fuel tests PASS;
- Python compile PASS;
- Fuel Admin JS/JSX parse PASS.

Safety:
- reconciliation workflow never executes a payment/refund automatically;
- DKV preview remains read-plan only;
- provider/payment/pump LIVE execution remains fail-closed.


## Provider activation readiness checklist (2026-10-13)
Implemented:
- provider activation evaluator combining signed contract rights, confirmed provider capabilities and a separate non-secret credential-ready flag;
- admin-only provider activation endpoint;
- explicit discovery/fueling READY vs BLOCKED evaluation;
- detailed missing-gate lists for both discovery and fueling;
- provider detail page now shows activation readiness and missing gates;
- credential readiness is represented only by FUEL_<PROVIDER>_CREDENTIALS_CONFIGURED boolean metadata; no API key or secret value is read or exposed.

Verification:
- 88/88 Fuel tests PASS, including commercial quote comparison and activation checks;
- Python compile PASS;
- Provider Detail / Fuel API JS/JSX parse PASS.

Safety:
- readiness status alone never enables live execution;
- provider capability confirmation remains required in addition to contract rights;
- DKV remains blocked for fueling because station discovery/fueling/payment/split-settlement are not confirmed.
