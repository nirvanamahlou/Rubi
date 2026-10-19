# Call Center package three — internal telephony readiness

Update2026-10-19: the owner requested removal of the entire telephony settings/internal-test section from the Call Center page. The component is no longer mounted; the UI instructions below document the earlier implementation and require an explicit future restoration.

Status: internal synthetic pipeline implemented; **Issabel is NOT CONNECTED or verified**. This is a stacked task on package one, package two and the global request queue (`dc6cb70a`). No real provider endpoint, payload, credential scheme, audio URL or latency claim has been invented.

## Ownership and durable flow

- `packages/contracts/src/telephony.ts`: versioned provider-neutral event. Every optional event field is explicit null. Server receipt time is stored separately in Inbox and passed into the domain projection; browsers cannot supply it.
- Integrations owns connection policy, unique connection/extension mappings, versioned mapping audit, encrypted canonical Inbox and dispatch Outbox. External identifiers are scoped HMAC fingerprints; provider raw payload is never retained. Canonicalization rejects unknown fields, invalid combinations, stale/future events, non-canonical numbers and payloads above16KiB.
- Customer Affairs owns the public transactional projection port, one existing CallCenterCall per connection/root identity, separate encrypted leg states and recording references, recipient snapshots, completion queue and server tab lease. No automatic Customer/Passenger merge, request, follow-up, sale or financial mutation occurs.
- Ingress commits Inbox + Outbox before acknowledgement. Duplicate identities with identical canonical content return the original receipt; different content conflicts. A transaction processes Inbox and business projection together. Workers can repeat the job safely.
- Worker uses existing BullMQ/Redis; jobs contain only an Inbox UUID. Outbox is re-scanned every two seconds. Failed transport jobs are retried on a later sweep; database attempts use capped exponential backoff with jitter, six attempts, typed error codes and dead-letter audit. Administrative replay requires native Integrations settings authority and branch scope.
- Root-terminal facts never regress. A terminal leg does not end the root. End-only events persist for completion. Late recording references do not reopen calls. References are opaque and encrypted; actual playback/download is unsupported.
- A mapping is snapshotted at receipt and revalidated against IAM at processing. Inactive/ineligible recipients do not receive new offers. Unknown or no-longer-eligible destinations enter authorized administrative review; there is no branch-wide broadcast. Transfers and claims use a row lock/version check and preserve prior offers/audit.

## Delivery and UI

The authenticated ERP shell runs an authoritative, bounded two-second polling feed. This is intentionally not advertised as a verified low-latency telephony stream. Every poll reuses current cookie authentication, permissions and server branch grants. Incomplete calls survive reload/reconnection; queue pages and a separate bounded recent-attention projection keep new arrivals visible even with a backlog. The current form is kept stable. A different open ERP dialog delays automatic opening, while the call remains queued.

Visible tabs renew a server lease for10seconds. Hidden tabs release it; inactive browsers have no guaranteed OS notification or background timing. Another tab can view queued work but cannot accept/write without the lease. Call claims additionally serialize competing agents. No audio autoplay or OS notification guarantee is made. A permission/session failure clears private popup state and stops polling until an explicit retry. Drafts are memory-only and guarded on navigation; Escape/close preserves the draft for reopening, but refresh requires re-entry of unsaved text. Stored calls are unaffected. Deferring keeps incomplete work; ending a call never closes its form.

The popup separates immutable technical data from business name/subject/notes, shows the latest three calls for the same authorized contact, accepts anonymous callers, supports acceptance/defer/save and same-branch authorized transfer. Saving marks an explicit business review complete; unknown identity/source/outcome remain unknown rather than inferred from telephony. Root-call creator FK is the connection custodian for provenance, **not an assertion that this person handled the call**; operator-registration reports include manual origins only. Synthetic contacts have a separate fingerprint namespace, synthetic labels and origin, and are excluded from operational call reports.

The Call Center page contains a collapsed telephony section. Native Integrations administrators can configure inactive connections, clock policy, extension/user/optional-team mappings, inspect mapping/processing audit, inspect dead letters/replay and assign unresolved calls. Existing `amin` grants are unchanged. No real connection can become active through this package.

## Synthetic review guide

1. API must use `NODE_ENV=development` or `test` AND `TELEPHONY_SYNTHETIC_ENABLED=true`. Production rejects the harness even if the flag is set. Default is disabled. No unauthenticated ingress endpoint exists.
2. Worker requires a random `TELEPHONY_WORKER_SECRET` of at least32characters, shared only with API, plus `TELEPHONY_API_URL` pointing to the trusted API base. Use TLS/private networking outside localhost. Existing Redis configuration is reused; secrets must never enter Git.
3. Sign in to localhost3000 with an account holding Call Center read/workflow permissions. Open the collapsed telephony section and choose **تماس مصنوعی تازه**. Only the authenticated user can be the synthetic destination; the reserved fictional number `+12025550123` or withheld identity is used.
4. The event passes through durable Inbox/Outbox and real Worker. The global popup appears on any authenticated ERP page. Accept handling before saving. Generate another call to inspect the queue without losing the current draft.
5. Send answer/end/recording-reference events. The recording is deliberately a non-playable synthetic reference. Test Escape/reopen, defer, refresh, two tabs, hidden tab and reconnect. Logout/revocation must stop receiving.
6. Advanced event tests use the authenticated internal harness or the in-process canonical port in disposable tests; real provider ingress remains absent. Contract tests cover duplicate/conflicting identities, clock bounds and explicit unknowns; domain tests cover out-of-order/end-only/late audio, mapping changes, review routing, leases, claims and retry/replay.

Local-only reproducible Redis proof: after compiling API/Worker and running the disposable PostgreSQL telephony tests, run `node --env-file=<local-env> scripts/call-center-telephony-smoke.cjs`. It enforces localhost and the named disposable database, reuses only synthetic test fixtures, creates a unique queue, uses a temporary authenticated local transport on4331 and closes its own Worker/server. It verifies Inbox→real Redis/BullMQ→Worker→transactional domain plus stopped-Worker recovery and duplicate suppression. It does not authenticate as a real employee or call a provider.

## Retention, bounds and operational notes

- Processed encrypted canonical Inbox bodies expire after7days; dead-letter bodies expire after30days and can no longer replay. HMAC dedupe tombstones and audit remain. The maintenance sweep enforces expiry; monitor Worker uptime.
- No raw provider payload, audio bytes or credential is stored. Business/technical call history follows existing ERP retention pending a separately approved real-call retention policy; production provider activation remains blocked.
- Synthetic ingress is capped at120events/connection/minute. Worker drains50 pending identifiers per sweep, concurrency4/max40jobs per second. A call supports128legs and32recording references; larger leg graphs reject to review instead of unbounded private JSON growth.
- Queue pages25, recent attention25, short history3, admin views50/100. Administrative views are bounded diagnostic windows, not exports. Reconciliation is an explicit unsupported extension port, not simulated success.
- Additive migration `20261020010000_call_center_telephony` adds eight tables, FKs and indexes and widens the existing origin check while retaining all historical values. No unrelated pending migration is applied. No dependency/lockfile change.

## Information required from Issabel before a real adapter

Exact deployed product/version and integration documentation; documented transport and ingress authentication/signature/replay protection; network/TLS/retry/acknowledgement behavior; stable connection/event/root/leg identifiers; ring/answer/end/transfer/queue semantics and terminal-root signal; ordering/sequences; masked numbers and inbound/outbound normalization; line/extension/queue routing; timestamps/timezone/clock accuracy; recording-ready lifecycle, authorized retrieval and retention; supported replay/history/reconciliation and rate limits; sandbox credentials and consented test numbers; concurrency/failover limits. Agree mapping ownership, unresolved-call policy, recordings/retention authority and production monitoring before activation. Only then measure end-to-end ring-to-popup latency.

## Verification evidence

- 49 focused API/PostgreSQL/HTTP/domain/authentication checks passed (48 in the regression run plus the machine-auth test); the final telephony/audit/auth subset11 passed after the last server change.
- All5 Worker tests passed, including3 telephony tests (disabled mode, authenticated transport, recovery on the next sweep). Worker build, typecheck and scoped lint passed.
- Real Redis/BullMQ integration proof passed, including a stopped Worker and durable replay.
- Chrome155 and Edge155 isolated synthetic UI transport checks passed: global opening, simultaneous-call draft retention, end-event draft retention, Escape/focus return, lease-controlled actions, permission-revocation clearing and390px no horizontal overflow. Screenshots inspected locally. These are UI fixtures, separately from the real database/queue proof; authenticated owner visual acceptance remains pending.
- API4319 boot health200; attention/settings/machine endpoints without credentials all401. Optimized Web build and TypeScript passed; final build/lint runs are recorded below.

No PR, merge, production deployment or additional account grant is part of this task.

Final validation: full API typecheck passed after correcting an existing synthetic workflow fixture JSON input type; API and Web production builds passed, as did scoped API/Web/Worker ESLint.15 Web model/client regressions passed. A regression reminder test timed out during concurrent heavy builds and passed unchanged in the isolated48-test rerun. Runtime localization catalogues were regenerated against the preserved runtime overlay after a source-only sync; no unrelated source translation was added.

Local activation: API4000 PID7940, Worker4409 PID17716, Web3000 PID20300; build `2Z4HqLsKd7fBzWWDpWG0p`. Web/API/Worker health200, unauthorized call and machine endpoints401, authenticated Worker GET200/POST201.18 Web checks passed including3 localization checks after runtime regeneration. Secrets and backup remain in ignored local cache; no real employee credentials or account grants were changed.
