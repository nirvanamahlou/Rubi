# CONTRACT-TOTAL-PRICING-1014

PC-A; branch `codex/pc-a-contract-total-pricing-1014`. Owner authorizes implementation and develop merge.

New Sales contracts enter a total per currency rather than a sale price per passenger. No passenger or service sale allocation is inferred. The price/payment step displays the selected route, passenger count, flights and class, hotel dates and rooms, transfer directions and insurance. Review uses the same contract totals. Cheque calculation and payment validation consume the exact contract components.

## Compatibility

Sales Web produces opt-in `contractPackagePricingVersion: 1` on every selected service. Shared Contracts pricing validation consumes it in the same release and rejects mixing contract totals with ordinary service pricing or legacy passenger pricing markers. API and Web must ship together. Existing unmarked and `passengerPackagePricingVersion: 1` contracts retain their validation and stored amounts. Passenger identity/service assignments and quoted ticket fares remain unchanged. No database migration, historical rewrite, currency conversion or operational data modification.

An over-60 insurance surcharge remains an explicit OTHER service assigned to the named passenger. It is added once to the aggregate rial total. Contract-mode validation requires the aggregate rial amount to cover all such surcharges without inventing passenger sale amounts; legacy validation still requires that passenger's agreed price.

## Currency presentation

A shared symbol registry formats monetary displays and currency selectors across Sales, Reservations, Finance, Ticket Catalog, Purchasing, Organizations, Marketing, Pricing, Reporting and dashboards, including contract print output. The stored/submitted ISO code, search by currency name/code, Decimal arithmetic and grouping remain canonical. Common dollar currencies use distinct symbols (`$`, `CA$`, `A$`); currencies without a registered display symbol fall back to their ISO code. Currency glyphs are locale-independent and not translated into currency names.

## Validation

Focused tests cover independent currencies, exact four-decimal amounts, unchanged totals when passenger count changes, removal of legacy allocations/catalog amounts from contract totals, duplicate/invalid amounts, surcharge inclusion exactly once and aggregate coverage validation. Existing legacy passenger-pricing and insurance validation stay covered. Typecheck, formatting, scoped lint, affected tests and CI gate the merge. Final execution results are recorded in the assignment/status handoff.
