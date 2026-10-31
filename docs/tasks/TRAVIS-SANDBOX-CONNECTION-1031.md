# Travis insurance sandbox connection — 2026-10-31

## Official API and confirmed behavior

The owner supplied the sandbox credential and official Swagger at https://sandboxapi.travis.ir/swagger/index.html. The published Main API contract is https://sandboxapi.travis.ir/swagger/v1/swagger.json (NoyanCoreWebApi v1). Authentication is the server-side `x-api-key` header. HTTPS was verified and is required by this connector; redirects and alternative/production origins are rejected.

Read-only POST operations:
- `/api/General/Countries`, JSON `{}`: countries with numeric ids and ISO codes.
- `/api/General/Duration-Of-Stays`: supported durations.
- `/api/Plans/Search`, JSON `{}`: generic plan catalogue, not a passenger quotation.

A successful response has numeric `code:200` and an array in `data`. A real sandbox test of the implemented adapter returned195 countries,21 durations and5 plans. Only identifiers/titles/ISO codes are projected; neither credentials nor upstream errors/account/person data reach clients. Responses are bounded to2MB/5000 rows, with15-second timeout, no automatic retries and no redirect credential forwarding.

## Application behavior and authorization

Reservations settings expose a private no-store `GET /api/v1/reservations/insurance/provider/catalog?branchId=<uuid>`. Existing branch scope, `reservations.read`, `system.settings.manage` and System Management insurance field controls apply before any provider call. Settings report `SANDBOX_CONFIGURED` only when environment configuration is present; successful catalogue retrieval reports `SANDBOX_CONNECTED`.

The Insurance Settings screen provides Retrieve insurer information and provider country/plan selectors. Choosing an item changes only the unsaved provider mapping/code/title; existing Master Data references, manual rate matrices and CAS/audit save remain authoritative. No automatic master-data creation or price overwrite occurs.

## Private configuration and rollout

Set API-only environment variables:
- `TRAVIS_SANDBOX_ENABLED=true`
- `TRAVIS_SANDBOX_BASE_URL=https://sandboxapi.travis.ir`
- `TRAVIS_SANDBOX_API_KEY` through the private environment, never Git or NEXT_PUBLIC.

Default example configuration is disabled and contains no key. Missing credentials or any different origin fail closed. The owner selected Avina server activation. Preserve its currently running independent API/Web fixes, private volumes, worker and existing environment; add a dedicated private sandbox env file to API only. Verify immutable target source hashes, build/test the overlay, back up current state, activate with rollback and verify provider counts plus public health/authentication. No schema migration is required by this connector.

## Limits retained from DEC-OPEN-014

This is sandbox connectivity and catalogue discovery, not policy issuance, confirmation, cancellation, payment, refund, premium calculation or coverage. No real passenger is sent to the provider. Those operations require separately implemented transactional/idempotent orchestration, verified policy responses and explicit user actions; existing draft/issuance boundaries remain unchanged. No policy number is fabricated.
