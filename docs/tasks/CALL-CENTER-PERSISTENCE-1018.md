## Durable Call Center — 2026-10-18 / PC-C

The user's follow-up authorizes Customer Affairs-owned durable call/contact/note
storage and local activation. Three additive tables retain Branch/User/contact
foreign keys. Normalized telephone HMAC groups contacts only within one branch;
call snapshots and note bodies are encrypted using existing configured contact
keys with a distinct call-center AAD. Independent Call Center permissions and route
access govern reads, calls and notes. Call/note UUIDs are stable replay keys;
changed payloads conflict. Audit records contain IDs/metadata without plaintext.
Phone-provider integration, external recording URLs and realtime event delivery
remain a separate Integrations unit; no provider is simulated. Browser verification uses a clearly labeled synthetic contact only.

## Call Center v1 — durable UI/API contract

GET /api/v1/customer-affairs/call-center?page=1&pageSize=50 returns complete
call/note histories for a branch-scoped contact page. x-branch-id selects only
an actor-authorized branch; omitted means the actor's first authorized branch.
POST /calls receives a stable UUIDv4 id, normalized telephone, ISO time,
INBOUND/OUTBOUND direction, bounded traveler/subject/source/operator/summary
fields and one of the existing UI follow-up states. POST /contacts/:id/notes
receives a stable UUIDv4 id and bounded note text. Identities and creation times
for notes are server-owned. The module-local DTO/client ship together; additive
IAM contract v14 introduces three independent Call Center permissions. Route authority
also applies. User-controlled audio/provider/actor fields are rejected.

Calls are append-only: a later call to the same normalized number shares its
branch contact and increases history; the UI orders contact rows by latest call
UTC time. Saved notes belong to the durable contact. The UI clears the form only
after server success, preserves entries on failure and reuses its event ID on
retry. No browser storage is used for durability. Scope changes remount/clear
state and abort pending reads. Production no longer initializes demo fixtures.

Validation: all164 migrations apply on a new disposable PostgreSQL18 database;
seven crypto/PostgreSQL tests pass, including ten-way call replay, five-way note
replay, chronology, branch separation, permission denial, encryption and service
recreation; four HTTP validation/authentication tests pass; Web client/model/nav/
i18n27 tests pass. Initial HTTP setup timeout under simultaneous cold compilation
passed on isolated rerun. Scoped API/Web lint and candidate API/Web production
builds pass. Existing CI gains an additive opted-in PostgreSQL proof step.
Runtime activation and browser persistence evidence are recorded below.

## Local compatibility and access

The active local database lacks the unrelated pending currency migration. After a full ignored local PostgreSQL backup, only migration 20261018200000_call_center_persistence was applied; its pending-migration preflight allowed exactly that migration. Runtime assembled from c0c51d56 preserves the existing local modules instead of deploying unrelated develop changes. New tables and IAM constants ship together. Independent permissions are customer_affairs.call_center.read, customer_affairs.call_center.calls.create and customer_affairs.call_center.notes.create. Existing Lead permissions remain unchanged and do not grant Call Center access. IAM contract version14 adds these codes without renaming/removing existing codes. API and Web are the consumers; permission seed labels are the producer catalogue. No backfill or broad seed is run.

The user explicitly approved assigning exactly these three permissions to username amin. A dedicated user-only local role was created with collision/shared-role checks and a serializable transaction; the IAM audit records the grant. Existing shared roles, Lead access and unrelated permissions were not altered.

## Verified local runtime and publication

The local Web build `sqCWCdWaSY8jYAmSagXz7` and API were activated on ports3000/4000. Account amin saved a clearly labeled synthetic contact, an inbound call, an outbound follow-up and one independent note. After a complete browser reload, both calls, follow-up count1 and note were fetched from the server and remained visible. No browser storage or intercepted responses were used. The synthetic review record is intentionally retained. The optional Next output directory permits a parallel build while the existing build remains available; its default stays `.next`.

PostgreSQL integration7, authenticated HTTP4, IAM contract4, manual-access25 and Web/client/model/navigation/i18n27 tests passed. The translation scan exceeded its existing timeout under concurrent cold filesystem scans; isolated rerun passed all3 coverage tests. API/Contracts/Database lint and API/Web production builds with TypeScript passed; final CI validates the complete candidate. Only the Call Center migration was applied locally after backup; the unrelated pending currency migration remains unapplied.

On2026-10-19 the user authorized pushing all final local Call Center changes, creating a PR to develop and merging only after all CI/CD checks pass on the final head. The source candidate carries the same Call Center implementation as the active scoped runtime, retaining newer develop changes in unrelated modules. Runtime-generated next-env references, build output, local backup, credentials, permission assignments and synthetic database records are excluded from Git.

PR966 first hosted run passed the complete production build and PostgreSQL migration/seed gate, including durable Call Center integration. The full test suite caught an incorrect module label on the three new permission seed entries; corrected to the established `customer_affairs` owning-module code. Both permission seed catalogue regressions pass locally. No permission code, grant scope or gate was removed. All final-head CI checks must pass before the authorized develop merge.
