# Contract passenger completion

PC-A;2026-10-26. Owner first requested local preview, then explicitly authorized push and develop merge. Candidate branch: `codex/pc-a-contract-passenger-completion-1026`.

## Behavior and ownership

Historical contracts already contain per-service adult, child and infant counts but no identities. Sales correction offers **Add passenger** for this state. It reuses the Customer entry table, passport identity fields, country helpers and calendar toggle. Slots derive from registered category counts. Users may choose existing profiles, select the booked outbound/return/service membership and enter individual hotel dates.

Customer remains the identity/contact producer through its existing public Sales APIs. Profile creation can finish before contract completion; the UI retains the created profile ID and retries remaining work rather than deliberately recreating it. Existing profile matches are presented for review and never overwritten by this form. Sales persists real contract membership and service allocations; Reservations reads the current Sales execution for its passenger list and output. Existing issued snapshots remain historical evidence.

The additive GET/POST `sales/contracts/:id/passenger-completion` use existing scoped Sales correction authorization. Save requires complete identity/passport facts, unique customer membership, exact booked per-service age counts, valid hotel dates and current contract version. The original aggregate marker is archived under `completedLegacyServicePartiesV2` so subsequent current output renders named passengers. Contract membership, service metadata, version, audit and Reservations notifications commit in one Serializable transaction. A recorded operation can be replayed without duplicating membership. No price, payment, ticket-capacity reservation or schema is written by this command.

## Validation and local preview

- 45 API checks: completion, correction, current execution and Reservations passenger consumers.
- 39 Web checks: completion rows and contract output/amendment regressions.
- Contracts/Database generation/build, API production build,66-route Web production build with types and scoped API/Web lint passed locally.
- Browser verification was not completed: Computer Use stopped because it could not confidently determine the current browser URL.
- Preview Web3100 targets API4200 and an independent local database `rubi_passenger_completion_1026`, copied from the local historical-contract preview. Existing repository migrations were applied only to that copy. No new migration, operational database write or server rollout is part of publication.

Full quality, tests, PostgreSQL migration/seed and production-build checks on the final GitHub revision are required before develop merge. No main merge or production deployment is requested.
