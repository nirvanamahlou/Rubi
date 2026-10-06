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
