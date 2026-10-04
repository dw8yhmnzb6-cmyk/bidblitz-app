# BidBlitz Central Admin SSO Contract

## Purpose

The existing BidBlitz admin is the single control plane. Child projects keep
their own databases, sessions and authorization models. Passwords are never
copied between projects.

## Central owner identity

- Stable subject: `BIDBLITZ_OWNER_ID` (default deployment value:
  `bidblitz-owner-primary`)
- Authority is granted only by the canonical BidBlitz admin record.
- Login aliases may identify that same record but must never promote another
  customer or admin record.

## Handoff claims

Every handoff is HMAC-SHA256 signed with the deployment secret and contains:

- `iss = https://bidblitz.ae`
- `aud = <project id>`
- `sub = <stable central owner id>`
- `role = owner`
- `permissions = ["*"]`
- `iat`
- `exp` (60 seconds; receivers reject lifetimes over 90 seconds)
- cryptographically random `nonce`

## Receiver requirements

A child project MUST:

1. verify signature, issuer, audience, timestamps, role and permissions;
2. persist a digest of the nonce and reject reuse;
3. map the stable owner id to an explicitly configured existing local admin;
4. verify that local account still has the project's canonical admin role;
5. create a normal native project session using the existing auth stack;
6. audit the central login;
7. never create or elevate a user automatically from SSO claims;
8. never change MFA/passkey settings during SSO.

## Activation

SSO is fail-closed. The central secret alone is insufficient. Each project also
requires an explicit activation flag:

- `BIDBLITZ_SSO_EYES_ENABLED`
- `BIDBLITZ_SSO_TRADE_ENABLED`
- `BIDBLITZ_SSO_AION_ENABLED`

Future projects follow the same naming convention.

## Current adapter status

- Eyes.BidBlitz: adapter implemented and CI tested; production activation pending.
- Trade BidBlitz: adapter implemented on isolated branch; production activation pending.
- AION: adapter implemented on isolated branch; real base URL and production activation pending.
- BidBlitz Verify: sandbox adapter implemented locally; Verify remains development/test-only.
- NEX / Stack: domain known, no verified SSO adapter yet.
- Power / Conformexa / The Eye and other projects: not centrally connected until their actual runtime/auth implementation is verified.

A known URL never counts as a connected admin project.
