# MARKETING-DOCX-1006

PC-B, branch codex/pc-b-marketing-docx-1006, base origin/develop@fbdc267e.
Source: C:\Users\admin\Desktop\مارکتینگ.docx, 30 non-empty ordered paragraphs (verified by DOCX extraction on 2026-10-06).

Publication is internal campaign activation; unavailable external integrations are reported.
Manual campaign progress/spend are planning declarations with provenance, not financial posting or attributed revenue.
Customer Affairs owns lead data. Public contracts only; branch authorization, audit, CAS and idempotency remain mandatory.

Current bounded limitation: campaign owner and sales-expert assignment are restricted to the authenticated actor. This avoids direct IAM table access; cross-user selection remains pending an IAM-owned public same-branch validator/selector contract.

## Ordered checklist

1. Icon-only Marketing buttons with accessible names.
2. Campaign calendar date-range filter, current month default, remove other calendar filters.
3. Remove campaign list heading/help text.
4. All UTM fields optional.
5. Repair false date-range error; retain genuine chronology validation.
6. Campaign create includes owner and sales target and other editable detail fields.
7. Replace preview submit with actual internal publication.
8. Separate campaign edit form for manual target progress, actual declared spend breakdown and links.
9. Remove daily sales trend and channel status from campaign overview.
10. Remove approval workflow from Marketing.
11. Remove explanatory headings above audience panels.
12. Remove dynamic-segment preview button.
13. Functional named segment creation.
14. Remove aggregate-group dialog explanation.
15. New lead form: phone/source/campaign/status/sales expert/last follow-up; score operation from checked rules.
16. Redesign lead details.
17. Remove first/last source boxes.
18. Enlarge the source chart with a date filter and actual owner-query lead counts per source.
19. Remove communications send history.
20. Remove message-template section.
21. Save composer fields as table records; reopen in View/Edit; icon-only delete.
22. New scheduled-send form selecting saved message/campaign/channel/date-time/status; durable save.
23. Remove upload confidentiality field; retain Documents policy at its public boundary.
24. New form with name/type/campaign/status/completion rate/response count/landing page.
25. New landing page with domain/site/campaign/form/visits/conversions/last publication/status.
26. New short link with table fields and expiry.
27. Move coupon status down and remove helper text.
28. Remove coupon usage report.
29. Remove journey automation executions and execution history.
30. Four-sided automation node connectors; Add Stage creates connectable nodes.

## Delivery evidence

- Schema and migration: `packages/database/prisma/schema.prisma` and migration `20261006110000_marketing_docx_phase_b`; rehearsal applied successfully to isolated PostgreSQL database `marketing_docx_1006`.
- Contracts/API: versioned campaign, asset and owner-side protected intake contracts; service-level branch/IAM, CAS, idempotency and atomic audit boundaries.
- Web: server-backed campaign, segment, intake/source, message/schedule, content/link and automation flows. Failed API calls remain errors and require retry.
- External publication, provider dispatch, site publication and financial posting remain unavailable and are not simulated as successful.
- No live-browser interaction check was run. Component source-contract tests and API-client executable tests do not substitute for browser UI verification.
- The migration was replayed successfully before two additive list-order indexes were added. The amended schema validates and generates, but a fresh amended replay is gated because the isolated PostgreSQL endpoint `localhost:55473` is currently refusing connections.

### Fresh review-repair evidence

- MKT-R3-001/006/010: PATCH authorizes the persisted immutable kind before replay; MESSAGE→SEGMENT, SCHEDULE→MESSAGE and FORM↔LANDING_PAGE references require exact same-branch types. Composer audience, multiple channels, send mode/date and durable segment selection survive View/Edit.
- MKT-R3-002: Marketing no longer submits a hidden classification; Documents keeps configured/type defaults and its confidential-code policy.
- MKT-R3-003/004/008: campaign adapters round-trip owner, target/budget currencies, every UTM field, all spend rows and links. Live detail/budget UI uses server data; exact BigInt-scaled sums remain grouped by currency and rendered as strings.
- MKT-R3-005/007/011: URL and numeric content fields are separate; automation View/Edit retains ID/version and selectable four-sided ports with visible saved edges; lead detail, type dropdown and icon-only New/reset controls are present.
- MKT-R3-009/012: create/publication retries retain stable idempotency keys and the created draft; Persian calendar defaults/navigation recompute the displayed Persian month range with physical LTR controls.
- Marketing create/update/delete notification-feed invalidation occurs only after a confirmed server success; failures emit no success event and no phone/code is copied into the event.
- Executable adapter regressions cover populated campaign save/reload mapping, exact large/fractional mixed currencies, lost-response/publication retry, normal HTTP(S) URL paths and graph CAS/ports. These are functional serialization/retry tests, not claims of live button/browser coverage.

## Final local verification

- API focused tests: `node node_modules/vitest/vitest.mjs run src/marketing` from `apps/api` — exit 0, 8 files / 61 tests; 3 real PostgreSQL proof tests are opt-in and skipped locally. Exported reference validation denies missing Marketing read/attribution permission and wrong-branch actors; Customer Affairs passes the current actor to the owner service.
- Web focused tests: `node node_modules/vitest/vitest.mjs run src/modules/marketing src/components/ui/calendar-direction.spec.ts` from `apps/web` — exit 0, 8 files / 38 tests. Executable adapters cover failure/reload, populated field mappings, retry, URL and graph behavior; source-contract assertions are not claimed as browser interaction proof.
- API scoped ESLint, Web scoped ESLint, API and Web TypeScript checks — exit 0.
- Contracts and Database TypeScript builds — exit 0. Post actor-only-guard API Nest build — exit 0.
- Web `next build --webpack` — exit 0, compile/TypeScript/static generation complete for 55 routes. Two later presentation/state-adoption lines (icon-only campaign New and graph accepting the returned version) have final lint/typecheck/tests but await refreshed exact-source CI build.
- Prisma format, validate and local client generation — exit 0 against the amended schema.
- Local amended migration replay remains unavailable while `localhost:55473` refuses connections; the existing PostgreSQL 18 job now also runs the opt-in real Marketing concurrent-CAS, replay/altered-payload and rollback proof after all migrations and seed. Its refreshed CI result is pending.
- `git diff --check` — exit 0 (line-ending warnings only).

### Review2 repair evidence

- MKT-R3-002: protected Marketing uploads collect the six-digit Documents access code when the selected owner type defaults to `CONFIDENTIAL`; the public upload receives `confidentialAccessCode` and Marketing still never overrides classification.
- MKT-R3-007: the shared graph canvas renders persisted SVG edges from their selected top/right/bottom/left ports. The rendered-component regression verifies line and port output, while the adapter regression preserves graph ID/version/ports across reopen and save.
- MKT-R3-009: an uncertain create response is reconciled with the original payload and idempotency key before a corrected input updates the same draft ID and publishes it. Publication replay keeps its key and adopts the returned version. Reloaded `DRAFT` detail exposes the separately authorized publish action.
- MKT-R3-011: active durable controls and campaign/calendar navigation use accessible icon-only buttons. Scheduled sends use one displayed/persisted channel; composer keeps multi-channel selection; successful save and New both reset every message/schedule field through the same state initializer.
- MKT-R3-013: the genuine PostgreSQL replay proof asserts the structured 409 `IDEMPOTENCY_CONFLICT` response and the actual `UPDATE_DECLARATIONS` audit action without weakening entity/command/audit, CAS or rollback counts. Local PostgreSQL remains unavailable, so the next existing PG18 CI run is still the execution gate.
- MKT-R3-014/015: FORM and LANDING_PAGE selectors retain their exact same-branch typed relationship in both directions; campaign form validation accepts and preserves four fractional budget digits.
- Final local checks after these repairs: Web Marketing/calendar 11 files / 46 tests, API Marketing and affected Customer Affairs 61 passed / 3 local PostgreSQL skips, Web/API typechecks and scoped lint pass. No authenticated browser QA is claimed; the new SVG render test is server rendering, not live interaction.

### Review3 bounded recovery (base `66c33c17615404e97563cde0c11c0defd8cec050`)

Review3 superseded the prior writer's closure claim for four stable IDs. The eleven other findings remain frozen. This recovery changes only Marketing Web/tests and its own documentation; Documents/API/contracts/schema and granular execute/schedule permission checks remain unchanged.

The command plan was established before implementation: retain each uncertain command's original payload, key and version until replay resolves it, before processing newer form values. The actual API client returns `MarketingApiError` for HTTP rejections, while transport and unreadable-success failures can follow a commit. A later 401/403 or replay conflict cannot establish that an earlier uncertain request did not commit.

| Command | Confirmed success | Initial definitive rejection | Uncertain result, then corrected form | Reconciliation rejected |
| --- | --- | --- | --- | --- |
| Create | Adopt returned entity/version | Release rejected intent; corrected create gets a new key | Replay original create; update same ID with correction; publish | Retain original create, block newer input |
| Update | Adopt version and applied input | Keep entity; corrected update gets a new key | Replay original update/version/key; apply newer correction at returned version | Retain original update, block newer input |
| Publish | Remember explicit publication confirmation | Keep saved draft; corrections may update then explicitly publish | Replay original publication/version/key; apply correction to the now-published same entity | Retain original publication, block newer input |

- MKT-R3-002: type defaults are not effective branch policy. Marketing validates only supplied code syntax and lets Documents require/reject a code; users can enter or clear it and retry. No classification is submitted. Tests cover type/config combinations with/without a code through the public client and execute the actual upload form's no-code/protected-code/cleared-code handlers.
- MKT-R3-007: SVG lines, HTML node bounds inside SVG `foreignObject`, and port button centers use one pixel coordinate system and scale together. Canvas height grows with rows; long node content scrolls inside explicit bounds. Tests compare all four card boundaries, actual port centers and line endpoints at three viewports after save/reopen/edit; all port handlers and read-only disabling execute.
- MKT-R3-009: the real Marketing client is exercised against a stateful synthetic HTTP server enforcing replay fingerprints, same entity identity and CAS. Cases include definitive create/update/publish rejection, committed response loss, unreadable 200, committed 502, uncommitted 503, multiple corrections, nested input mutation, and uncertain commands followed by revoked permissions/replay conflicts. The existing saved-DRAFT detail publication entry remains available.
- MKT-R3-011: active reference-page actions share icon-only presentation with accessible labels/tooltips, preserving handler/form/disabled wiring. Actual library entry, upload cancel/submit/pending state, code correction and workspace detail-close controls are rendered and their relevant handlers exercised.
- Recovery verification: Web Marketing/calendar 13 files / 74 tests pass; API Marketing/affected Customer Affairs 61 pass and 3 optional PostgreSQL cases skip locally. API/Web typechecks and scoped lint pass; owned-file formatting and diff check pass. Initial exact-optional-property TypeScript errors and test-only type-import lint errors were corrected before the final checks. Prior exact-head CI passed all eight jobs including three real PostgreSQL proofs on `66c33c17`; that evidence predates this recovery. Fresh independent review and exact-candidate CI/build/PG are lead-owned gates. No browser acceptance, production build rerun, runtime mutation or operational database write is claimed.

### MKT-R3-009 successful-response repair

The campaign API client now validates each successful create/update/publication envelope and complete `marketing.records.v1` entity before emitting notification invalidation or returning it to the durable command state machine. It verifies contract version, field/date/decimal shapes, request identity where supplied, minimum resulting version, a valid status and operation-specific create/publication state, and the requested scheduled instant. A malformed or mismatched 2xx response is treated as an uncertain outcome, preserving the exact pending payload and idempotency key for replay; the feed is not notified as if the mutation were confirmed.

Regression coverage exercises malformed committed 200 responses for create, update and publication through the actual client and stateful HTTP harness, replaying the same command without duplicate creation; a separate client test rejects a mismatched publication identity and verifies no success notification. Web Marketing/calendar: 13 files / 78 tests pass. Web TypeScript, scoped ESLint, formatting and diff checks pass. The earlier passing CI/PG gates predate this final Web-only repair; a fresh PR head review/build/CI run is required. Browser QA, local runtime rollout and operational database writes were not performed.
