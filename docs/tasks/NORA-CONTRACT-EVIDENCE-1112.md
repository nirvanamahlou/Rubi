# Nora contract evidence (PC-C)
Sales produces two additive authenticated reads consumed by Sales Web/Nora. Neither issues documents, submits commands, or modifies a contract. Existing routes remain compatible. GET /sales/contracts/:id/document-readiness returns only delivery authorization and aggregate issuance/revision evidence after ordinary Sales detail authorization. GET /sales/submissions/:key looks up only the current creator's idempotency key, rechecks record access, and returns the saved reference and stage. Absence is a point-in-time observation, not proof that an in-flight transaction will never commit. No migration or production deployment.

Validation on an isolated local worktree: 95 targeted Web tests and 11 Sales API tests passed. Chromium ran the actual assistant composer against synthetic HTTP responses, not live customer data. The following 13 acceptance cases passed:

1. Exact contract reference on a later page; refuse ambiguous references.
2. Similar customer results require explicit contract selection.
3. Display simultaneous form blockers and reread after correction.
4. Distinguish create timeout from missing dispatch confirmation.
5. Preserve a successful contract when receipt upload fails.
6. Separate currencies, overdue instalments, finance decisions and receipt counts.
7. Distinguish restricted receipt/audit reads from empty results.
8. Distinguish partial reservation, amendments, finance clearance and issued tickets.
9. Display Tehran event times without exposing raw audit snapshots.
10. Page actionable assignments within each actor's permitted scope.
11. Use recorded transitions and intake receipt times, with explicit missing evidence.
12. Discard delayed replies when actor, branch, route or selected record changes.
13. Handle linked draft/concurrency/offer questions and multiple service topics.

Additional tests cover fractional currency arithmetic, duplicate/unassigned passengers, nested hotel stays, read-only document checks and retry after loss of the submission response. A candidate file matching the name and size of a failed upload is a reason to inspect the saved payment document, not proof of byte identity. A live offer is a reading at query time, not a seat hold or guarantee. Staging browser checks did not issue a real ticket, collect a real payment, or contact a supplier.
