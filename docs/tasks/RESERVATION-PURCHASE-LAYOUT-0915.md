# RESERVATION-PURCHASE-LAYOUT-0915

- COMPUTER_ID: PC-A
- Base: `origin/develop@b62054e3`
- Branch: `codex/pc-a-reservation-purchase-layout-0915`
- Scope: Reservations broker purchase form, service-kind validation, Finance supplier-purchase delivery gate.

The broker purchase form now has a full-width supplier lookup, a separate price and currency row, and a separate submit action. This removes the fixed-width lookup collision shown at desktop width. Only hotel and transfer services are offered. The API rejects ticket purchases from this route, and Finance's delivery gate counts only the hotel/transfer purchases handled by this route. Existing ticket purchase records remain readable, but they are outside this gate.

Hotel purchases can be entered as a total or a nightly rate. The nightly rate is multiplied by the number of UTC calendar nights in the latest supplier form dates, with the contract hotel dates as fallback. The payable total is stored in the existing Decimal amount field; no schema or migration is needed. Changing the input basis clears the old amount to avoid interpreting a total as a nightly rate.

Ticket purchase cost belongs to Ticket Catalog -> Procurement -> Finance. That producer is in separate PR #282 and must be reviewed and merged independently. This branch does not modify another branch or the shared localhost runtime.

Validation: 4 targeted Web tests and 6 targeted API tests passed, including nightly totals, service filtering, API ticket rejection and the Finance gate. Affected Web/API lint and typecheck passed. Production API and Web builds passed (46 Web routes). No migration, seed, dependency or live-data changes.
