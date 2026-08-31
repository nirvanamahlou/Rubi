# MASTER-003-CATALOG-USABILITY

PC-B — 2026-08-31 — READY_FOR_REVIEW

## Delivery and ownership

- Branch: `codex/pc-b-master-data-catalog-usability`, based on frozen PR #57 `6abd960625face7a130bdc65316785c449eb6bb0`. Parent branch: `codex/pc-b-master-data-demo-fixtures`.
- Stack: #57 → #55 → #54; the separately developed transport #47 is already included through #54. #58 has since integrated the published #55/#56/#46 snapshots into develop at `e25f288`. This branch has not merged/rebased develop, altered a parent, or changed a PC-A branch.
- Review the delta against #57, then coordinate integration with the owner/reviewer of #58. Do not merge this PR before reviewing its demo parent and the shared compatibility delta. No force push, main change, branch deletion or automatic merge.
- Master Data UI/API/Contract, own tests and demo tool only. One additive country-order migration and its schema field; Migration/Contract/docs remain under PC-B/MASTER-003 with this bounded handoff. No Dependency/Lockfile or Calendar reservation; no Customers changes or direct reads of other modules' tables.

## User-facing changes

- Shared Power action on records in all eight workspaces, including supplier collaboration cards and payment cards. Uses the record's actual resource, ID and optimistic version. Pending state prevents double requests; denied/stale writes surface an error. API permission `master_data.status.manage` is retained. Refresh occurs after persistence; no deletion or removal of FK relationships.
- Inactive supplier/broker records are visually distinguished from their independently recorded collaboration status. Editing collaboration metadata still belongs to the source form, not a new collaboration form.
- Two fixed column filters per catalog (45 resources), with accessible labels and individual clear controls. Values are validated and mapped through a fixed server allowlist, never caller-supplied database paths. Filtering affects count and pagination, not only visible rows. The same filter snapshot reaches Excel. Currency approval/history accepts the source/destination currency code filters as well.
- Transport tables use resource-specific columns: airline identifiers/names/country/organization/logo/connection/version; aircraft manufacturer/model/body; baggage route/class/passenger/allowance/unit/pieces/validity/version; manifest metadata; rail/bus organizations and model amenities. Existing profile popups and Persian/RTL tables remain.
- Hotels include bilingual names, geography, chain, rating, amenities, organization, saleability, meals, rooms, website, check-in/out, address, coordinates and last update.
- Geography includes country dependencies, region city counts, city airport counts, airport English name/local time/terminal count, and editable persisted country display order. Dependency counts cover **direct Master Data-owned references**, not undocumented cross-module usage.

## Explicit boundaries

- Exchange-rate workflow is not replaced with generic active/inactive commands. Approval, rejection and immutable history remain governed by the existing dedicated contract, with non-authoritative rates; no rates are seeded.
- Connections, documents, fleet/service capacity, operator vehicle-type counts and destination market tags without a published owner contract remain unavailable/owned elsewhere. No fabricated number, external connection or market tag is presented as live data.
- Country order is a stored display preference shown in the list; existing name/code/update sorting remains unchanged. Clearing the numeric form resets it to zero.

## Migration

`20260831140000_master_country_display_order`: adds `master_countries.displayOrder INTEGER NOT NULL DEFAULT 0` and a real check between 0 and 100000. Existing IDs, FKs, values and rows remain unchanged. API rejects negative, fractional and out-of-range values; normal version/Audit behavior applies. Omitted field preserves compatibility with older clients.

Prisma format/validate/generate and database package rebuild succeeded. All 25 migrations ran on an empty PostgreSQL 18 database. The inverse SQL was tested **only** in the disposable test database and restores the original schema without deleting country rows. For application rollback retain the additive column; do not run inverse SQL on user data without explicit approval and a verified backup of order values.

The migration was deployed to the existing local `rubi` database only after a fresh verified custom-format backup. Backup dumps and runtime logs stay outside Git in the user's private temporary directory. No reset, general seed or volume deletion was performed.

## Realistic local examples

The opt-in tool now accepts `--preview-realistic` and `--apply-realistic` in addition to the unchanged v1 commands. Apply additionally requires `RUBI_ALLOW_LOCAL_MASTER_DEMO=1`; target must remain the named local development/test database. Build the API and database packages first.

- Same 78 fixture IDs in 40 visible catalogs. Public labels include Türkiye/Istanbul/Antalya, Euro, BB/ALL, common aircraft models and natural service/sales-reference names. Business, hotel, bank, insurer and operator examples remain **fictional** and are not operational providers. Demonstration airport keeps its non-production test identifiers and explicit label.
- No real person's name, phone, account, card, rate, document, integration or credential is introduced. Existing synthetic contacts remain encrypted and masked; audit does not expose contact values.
- Full connected fixture pack is preflighted against original audit markers and version 1. Any edited/inactive fixture or non-demo actor history aborts the refresh without changes. New marker makes repeated runs preserve later user edits. Collisions or concurrent edits roll back the whole transaction; user-created records are never looked up by name and overwritten.
- Local result: preview 78 updates/0 creates with rollback; apply 78 updates/0 creates; next preview 78 reused/0 updates. Original non-demo records preserved. Audit attribution is an offline demo actor, **not** a provisioned IAM account/session.

## Verification

- Frozen install; Prisma format/validate/generate; API and Web typecheck/build: passed.
- Full default workspace tests: 994 passed (API 554, Web 364, Database 59, Contracts 14, Config 2, Worker 1). Optional database tests are not counted as passing by the default run.
- Separate PostgreSQL 18 suite: 9 passed, covering all migrations, repeated seed, preview rollback, collision/user-edit protection, realistic refresh, both filter paths/options for every catalog, status/version/audit for all 78 records, country order constraints and migration inverse. Test database created and removed by its exact validated unique name.
- API/Contracts lint and Master Data Web lint: passed. Full Web lint remains blocked only by existing `date-picker.tsx` set-state-in-effect / aria-required findings, outside this task; no Calendar edits.
- Live API `http://localhost:4000/api/v1/health`: 200. Login `http://localhost:3100/login`: 200. Signed-out `/master-data`: 307 to login. Protected catalog API: 401 without a session.
- Browser did not have an authenticated session; user was asked to sign in. **Authenticated visual/click/responsive smoke has not been claimed.** API4000/Web3100 remain running.
- Diff check and scope/secret scan performed before publication; no private configuration, dumps, logs, screenshots, actual PII or unrelated module changes belong in the commit.
