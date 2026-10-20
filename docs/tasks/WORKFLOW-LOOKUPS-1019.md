# WORKFLOW-LOOKUPS-1019

Owner requests selectable cross-section references for authorized workflows, explicitly Sales flights/tickets, without granting source administration; push and merge develop. No production rollout is requested.

## Authorization and data boundary

- Add `GET /master-data/selections/:workflow/:resource` and detail for a strict consumer/resource matrix. Require current native consumer authority, an allowed consuming screen and at least one permitted branch. A screen alone or a source read grant alone is insufficient.
- Project explicit label/relationship fields only. Lists force active status, stable name ordering and existing bounded pagination. Public name/code reference search avoids probing private organization identifiers through generic search fields. Historic detail can return an inactive label so existing records do not lose their captions; it is not an active choice or authority to save an invalid foreign key.
- Rewire existing reference reads in customer forms, reservation filters/editors/outputs, agency forms, accounting currency/channel selectors, Marketing agencies, Sales outputs/pricing and Ticket/Tour definitions. Existing Sales form-reference APIs remain compatible.
- Published flight search accepts authorized Sales/Reservations consumers; Tour departure selection accepts Sales. Branch constraints, route/date pairing, active status, capacity/pricing rules and owner-side revalidation/reservation are unchanged. Catalogue management/publication APIs are not unlocked.
- Add Customer owner selection API for Accounting and Marketing, returning only IDs and display names from permitted branches. Name-only search, active/unmerged records, no contact or identity-document properties. Marketing excludes missing/revoked latest consent and rechecks eligibility when saving the target reference.
- Generic source administration, detailed dossiers, sensitive disclosure, mutations, imports/exports and new-record creation retain native permissions. A selector does not confer permission to edit its source record or disclose passenger identity documents. HR organizational-unit and existing request-scoped voucher directories retain their established owner contracts.

## Verification

- API:129 focused tests across source repository/service, consumer HTTP authorization, Customer HTTP and minimal projection, Ticket/Tour selection and Marketing consent suites. Includes unauthorized/denied-screen/no-branch rejection, private-attribute stripping, forbidden source reads/writes/exports/unmask, invalid pagination/resource/ID rejection and return-ticket branch checks.
- Web: separate suites of212 and477 tests (overlapping scope), plus25 focused client/selector regressions. One formatting-sensitive assertion was updated to allow line wrapping; context-aware request expectations updated. No mock permission grants substituted for actual policy checks.
- API/Web TypeScript and scoped ESLint passed. Regenerated local Prisma outputs to match existing schema for compilation only; no schema change or migration/database command.
- Full exact-final-head hosted quality/tests/build/PostgreSQL checks must pass before merge. No live accounts, roles, grants, messages, contracts or server data were modified during testing.

## Release

No schema, migration, dependency, credential or configuration change. Deploy matching API and Web builds through the normal release process after merge; merge itself does not update production.
