# TOUR-HOTEL-PRICING-FLOW-0916

PC-A; branch `codex/pc-a-tour-hotel-pricing-flow-0916`, base `72cfdadf`.

## Behavior

1. Define the tour and its departure's outbound/return offers in Ticket Catalog.
2. On Reservations hotel rates, select that tour/departure. Destination and
   stay dates are prefilled. Tick hotels and enter broker, nightly base, currency
   per hotel and the existing six room factors. Save/reopen immutable revisions.
3. On Sales pricing, select tour and departure, then its linked rate pack.
   Display purchase for actual stay nights, adjusted hotel sale and complete
   room package with adult/child flights. A fixed adjustment uses that hotel's
   currency. Different currencies display as separate amounts joined with +.
   Commission can be percent or a fixed amount with its own currency and is
   deducted from profit only.
4. Save the editable draft and publish a version with the existing authorized
   second reviewer and settled Finance flight costs. Family occupancy is stored.
   Each hotel remains an independent alternative. Exports are deferred.

## Persistence and compatibility

Additive migration `20260916133000_tour_hotel_pricing_flow` adds nullable tour
FKs to rate packs/batches, family occupancy to drafts/publications, and JSON
currency amounts to published room rows. No old pack is guessed into a tour.
Legacy pack writes remain supported and linked packs cannot change departure.
Existing scalar publications remain readable. The shared exact-integer engine
is consumed by API and Web; no floating-point amounts or implicit conversion.

## Local validation

- Four exact-money tests cover six nights, fixed/percent changes, currencies,
  adult/child/business fares, commission, negative margin and missing cost.
- 25 targeted API tests cover pack validation, branch checks, departure linkage,
  current revision projection and multi-currency publication/readback.
- Seven Web table/pricing/math tests pass. API/Web typechecks pass.
- The original local database had migrations from other branches. A backup was
  restored into isolated `rubi_pricing_flow_0916`; only this task's additive
  migration was applied to that copy. Web3200/API4200 will use the copy. No
  IAM grants, existing role changes, shared-data migration or port-3100 switch.
- API/Web production builds (48 Web routes) and scoped API/Web/Contracts lint
  passed. API4200 uses the isolated copy; Web3200 uses the rebuilt API URL.
  Authenticated local-admin smoke: hotel page 200, pack list 200 (one existing
  pack), departure choices 200 (zero active departures in authorized branches).
  Pricing API correctly returns 403 because this account has no package_pricing
  permissions. No grants were made; enabling that account requires owner approval.
- Remote verification reports origin Rubi is PUBLIC, contrary to the initial
  private-repository context. Changes remain local; no source is pushed publicly.
