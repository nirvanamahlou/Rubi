# Whole-file Nora registration — PC-A preview

Branch: codex/pc-a-hotel-occupancy-import-preview-1006; continuation of PR671.

## Owner decisions

Register all eligible hotels, room types, exact guest tariffs and dates from the source in the selected existing country/city. Create missing hotels/room types through their owner public API. The whole-file supplier name defaults to «کارگزار آنتالیا ۱» and remains editable; missing supplier creation requires explicit checkbox confirmation. The current hotel-pack supplier contract references BROKER-role Organizations, not independent MasterBroker IDs; this consumer preserves that existing contract without a schema migration.

ROOM is a final-room price. Where an explicit guest-composition price exists for the same hotel/room/board/currency/adult/child-band shape, the owner explicitly chose that guest-composition price (e.g.2AD235.2 rather than ROOM84). Only matching covered days are removed from ROOM; uncovered dates and different guest/board shapes remain. Original workbook is unchanged. Remaining conflicting explicit tariffs never receive guessed latest/highest/lowest prices: all involved source rows are reported and require correction or explicit valid-only consent, alongside parser date/age errors.

## Implementation and boundaries

Reservations consumer reads fully paginated existing Master Data CRUD (read/create/update permissions unchanged). Exact normalized name matching merges only case/spacing/Unicode spelling aliases, not fuzzy hotel identities. Existing duplicate/inactive references fail closed; no automatic activation, city move, deletion or field overwrite. Country/city relation is revalidated. Existing hotel room links are unioned with required IDs using a freshly read version. Source room names are resolved globally and reused; existing ambiguous names require Master Data correction.

Date pairs, currency and board derive from the source, not manual form filters. Registration splits at50 hotels or85,000 UTF-8 JSON bytes, with30 room types/hotel and2,000 tariffs/room API limits. A single oversized hotel-period fails before reference creation; no silent truncation. Existing independent exact-only STAY packs retain nominal legacy base1/factor1 without applying legacy price multipliers. This does not implement legacy tour/package-generator support for exact occupancy tariffs.

Existing pack POST is atomic per pack, not across the whole file or Master Data. Actor plus canonical sorted payload produces stable replay UUIDs. On network/validation failure, accepted references/packs remain and accepted count is displayed; retry the same file/supplier/context to replay accepted commands. No destructive rollback. Supplier/reference creation uses ordinary owner CRUD; network-lost creates are resolved on the next full directory read, while ambiguity fails closed. No new guarantee of cross-browser concurrent reference-create idempotency is claimed.

The manual editor is clearly separate and collapsed for new imports. The existing bottom city/date/hotel browser shows persisted packs and edits exact prices through CAS. Navigation guards prevent changing the source context while a batch is running.

## Verification

- Web Reservations:251 passing tests, two existing opt-in skips.
- Added model and public-API orchestration regressions: source date/price/age preservation,50-hotel splitting, exact Decimal conflict comparison, room-vs-explicit policy and uncovered dates, invalid/ambiguous references, permission/geography preflight, original link preservation/version guards, partial registration and stable retry keys.
- Scoped ESLint, Web typecheck and webpack production build55 routes passed.
- Private corrected-file read-only test:41,070 input rows =38,019 eligible prices +2,010 overridden ROOM +884 conflicting prices +157 invalid source dates.65 eligible hotels,298 canonical source room names,389 planned packs; maximum80,290 request bytes. No actual file data registered during this test. Private source workbooks, JSON, helpers and logs remain unstaged.
- No authenticated end-to-end import, operational DB write, live3100 rollout, migration, dependency or develop merge. Human preview review on3210 remains required.
