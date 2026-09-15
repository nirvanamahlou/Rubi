# HOTEL-RATE-PACKS-0915 — Reservations group hotel purchase rates

Owner: PC-A. Branch: `codex/pc-a-hotel-rate-packs-0915`, stacked on unmerged
Package Pricing PR #278. User explicitly excludes changes to Sales Package
Pricing. Preview target is Web3200/API4200 and the separate synthetic
`nora_hotel_preview` PostgreSQL database; Web3100 and shared data are outside
scope.

## Workflow

1. Select branch and city. Reservations receives active city and saleable
   same-city hotel options via `MasterTravelDirectory`, a public Master Data
   boundary. There is no dated room-inventory producer here; checking a hotel
   is the operator's availability confirmation for this pack, not a provider
   guarantee.
2. Define check-in/check-out and currency/method; positive nights appear.
3. Tick hotels, enter a broker, nightly base purchase cost and six room
   factors directly in the grid. Unticked hotels are not rate rows.
4. Save a new pack (`POST /reservations/hotel-rates/packs`) or reopen a pack
   (`GET /packs/:id`) and save a revision (`PATCH /packs/:id`) with
   `expectedVersion` and idempotency key. Table rows (`GET /packs`) separate city
   and date ranges. Old free-form rows remain under the collapsed history.

2026-09-15 UX follow-up on the same draft PR #293: the old `+ بستهٔ جدید`
handler only reset an always-visible blank form, so it had no observable
effect. It now switches to explicit new mode, inserts a visible unsaved row
in the pack table, opens the edit sheet and focuses city search. Existing
packs are table rows rather than cards; branch/city/check-in/check-out/nights/
currency/method are a single metadata table row above the hotel-rate sheet.
The editor can be closed without saving; saved rows reopen in edit mode.

`reservation_hotel_rate_packs` owns stable branch/city/range identity;
`reservation_hotel_rate_batches` has additive nullable pack/city FKs and
version. Each edit appends a full new batch/rows. Pack version CAS and unique
pack/version prevent concurrent overwrite; audit is transactional. Existing
batch and row IDs used by Sales publications are immutable. The Reservations
public purchase-rate projection filters out superseded pack versions and
retains the existing v1 shared-contract schema, so Sales source consumption
requires no source edit. Existing legacy `GET/POST /reservations/hotel-rates`
endpoints remain readable/compatible.

## Verification / handoff

- Prisma validation/client generation and additive migration on only isolated
  preview PostgreSQL passed; migration is not applied to an operational database.
- Focused Reservations API tests: 19 passed; Web rate/date tests: 4 passed.
  Scoped API/Web lint and production builds passed. Live synthetic Tehran
  2027-02-01→06 pack was created/reopened, changed from nightly base 100 to
  110 in version 2, then reread. Final Web3200 login/API4200 health and
  authenticated pack detail all responded 200; Web3100 was untouched.
- This task does not grant IAM permissions, change dependencies, create real
  inventory, alter Finance payments or change `/sales/pricing`. Stacked PR
  should be reviewed after Package Pricing PR #278; neither merges itself.
- UX follow-up: 6 focused Web tests (including draft/table markup), scoped
  lint, typecheck and 48-route production build passed. Web3200/API4200
  responded 200, Web3100 stayed untouched. Actual browser click requires
  product-owner visual QA; Codex app/auth UI was not automated.
