# Customer Affairs report data and E2E — PC-B

Date: 2026-09-13. Branch: `codex/pc-b-customer-affairs-report-data-e2e`.

## Delivered

- Repeatable, local-only fixture script: `infrastructure/scripts/customer-affairs-report-data.mjs`.
- Dataset `ca-report-synthetic-20260913-v1`: 24 requests, 36 tickets, 20 satisfaction responses, 8 corrective actions and 3 proposed Sales handoffs. Varied dates, priorities and statuses populate existing reports; no new reporting section.
- Natural display titles; synthetic provenance in CA audit/timeline and deterministic IDs. These are generated examples, not genuine customer feedback or business results.
- Own CA tables only; existing CA anchor supplies branch/actor references. No existing rows overwritten, no real customer/contact linkage, no outbound SMS or website calls, no migration or permission changes.
- Transactional preview rolled back successfully. Apply succeeded. Second apply returned zero added records in every category.
- End-date label is now `تا تاریخ`; shared Nora calendar unchanged. Report corrective statuses DONE/CANCELLED now display Persian labels.

## Verification

- Script syntax check passed. Web 46 scoped tests, scoped lint and production build/typecheck passed; date-filter 3 tests rerun passed after adding parenthetical absence assertion.
- Authenticated browser on local Web3100: created synthetic ticket `CA-T-2026-8E6991CF`, then TRIAGED → IN_PROGRESS → internal note → RESOLVED → CLOSED. Every step persisted in timeline. Final ticket ID `df575fda-3968-4974-85a6-2f77bc61d657`.
- Search by its natural title returned exactly one closed ticket. Same-day range 1405/6/22 through 1405/6/22 retained it and encoded `createdFrom=2026-09-13&createdTo=2026-09-13`. Clearing range removed both URL parameters and retained search.
- Calendar month and year grids opened; selected year 1405, month Shahrivar and day22 through the UI. End-date parenthetical absent.
- Before the extra E2E ticket, reports showed 30 requests, 41 tickets, 20 satisfaction responses (average3), and 8 corrective actions across four statuses. E2E created one additional closed ticket; no record was deleted for cleanup.

## Incident and limits

The first internal-note submission encountered HTTP500 when the API exited with `Connection terminated unexpectedly` from pg-pool/Prisma. PostgreSQL container remained healthy, not OOM-killed and with restart count0. Root cause of the connection interruption was not established. The combined launcher recovered API4190 using the existing environment and document-storage configuration. Reload confirmed the failed note had not persisted before retrying. The repeated note and remaining lifecycle succeeded. This is recovery evidence, not a root-cause fix or a claim of an uninterrupted green E2E run.

This was targeted browser E2E, not exhaustive coverage of every CA workflow. External SMS delivery, live website integrations, Sales acceptance and automatic cross-unit callbacks were not tested. Generated satisfaction must not be interpreted as real business performance. Existing list date filters do not filter aggregate reports.

## Runtime handoff

Combined checkout `C:/Users/admin/Nora-unified-customer-affairs-3100`; implementation commit `bccbfb71e5432a765a8b65926543ec95b165939e`; Web build `unified-F6makayd3neGQ-tTvkrk7`. Last verified Web3100 PID24760 / API4190 PID33612. Subsequent documentation-only commit does not change this build. No HR panel-removal changes included. Release Web runtime ownership to the coordinating HR task after final documentation; preserve API, database, backend connections, permissions and shared form references.
