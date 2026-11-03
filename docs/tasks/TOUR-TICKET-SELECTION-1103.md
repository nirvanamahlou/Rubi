# Tour ticket selection and departure sales state

PC-A; branch codex/pc-a-tour-ticket-selection-1103.

The independent travel-date controls are removed. Active outbound/return offers are loaded for the package route and branch and shown red, with their own dates. Departure boundaries derive from the selected flights (including overnight outbound arrival). Floating flight entry reuses ContractFlightEditor with an explicit positive capacity, creates a new FLOATING offer and consumes that independent offer's allocation ledger rather than unrelated charter inventory. Existing catalog legs retain their own normal capacity.

Departure stop/resume is stored in additive TourDeparture.isActive and salesVersion fields. Management requires the existing tour management permission, branch and optimistic salesVersion. Definition version and published price snapshots remain unchanged. Sales confirmation calls the public Ticket boundary with the selected departure, locks that departure row, verifies active state and exact offer membership before acquiring offer locks and recording seats. A stopped departure is displayed with zero sellable capacity; stop never cancels existing allocations or documents.

Compatibility: optional response fields default to active/version1 for old fixtures; expanded schema must be deployed before the new API. Migration is additive; no backfill/deletion. Existing allocation cancellation/amendment code remains authoritative. No new dependency.

Validation:43 focused API tests passed; Web/type/hosted checks pending. Local full API typecheck exceeded the configured2GB heap and is not claimed passed. No deployment requested or performed.
