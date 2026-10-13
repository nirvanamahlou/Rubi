# PACKAGE-PRICE-FIELDS-1008

PC-A; branch codex/pc-a-package-price-fields-1008, base origin/develop7065f335. Human owner explicitly authorizes develop merge after checks.

## Behavior and contract

Pricing landing overview cards are removed. Embedded TourWorkspace compact presentation omits heading/instruction/overview only, preserving departure creation, selection and canonical commands; standalone callers keep existing presentation.

Four legacy defaults remain initially present but every row can be deleted, renamed and independently priced. Stable kind retains adult/child/business multipliers and commission semantics through name edits. Added custom fields are fixed sale amounts once per room package; UI states that basis. Three-letter typed currency supports currencies beyond the old five options, with existing money precision policy (IRR0, others2). Commission supports its existing percent/fixed modes and preserves its value on mode switch.

Optional additive priceFields in v1 save/read/publication: omitted legacy requests remain accepted; existing dynamic field identities/custom amounts and deleted roles survive legacy saves. Null historical storage restores four legacy fields, explicit empty array does not restore anything. Shared validator bounds50 rows,120-character titles, unique IDs/default roles, amount precision/storage width, currency syntax and percentage0..100. Server derives authoritative legacy values from supplied rows, not untrusted duplicate scalar fields. Exact shared BigInt arithmetic adds custom sales per currency before commission/profit; no FX. Maker/checker, source recheck, branch scope, expected version/advisory lock and immutable publications remain unchanged.

## Persistence and rollout

One additive nullable JSONB column on each of the two Package Pricing-owned draft/publication tables. Historical records and publications are not backfilled or rewritten. Apply migration, then API, then Web. Existing foreign keys retained. No dependency/permission/seed/operational-data or local runtime changes. Source/schema/shared contract/catalogue locks reserved only for this work and release with review candidate.

## Verification

Focused Contracts8, Web47, API30 tests passed, including add/edit/delete/currency callbacks, legacy restoration versus deleted defaults, custom GBP calculation, persisted save/read/clear and publication copy. Contracts/API/Web typechecks and scoped lint pass; schema formatted/generated. Temporary-table migration probe could not finish because Docker timed out. Production builds and complete clean exact-head CI (including PostgreSQL migration/seed) required before authorized merge; local Windows build limitations are reported separately if encountered. No authenticated operational writes or browser QA claimed.
