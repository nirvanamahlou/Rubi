# REPORT-CANCELLED-TOTALS-1029

PC-C. Confirmed contract status is authoritative; never delete cancelled rows or
rewrite their historical financial events. Native Sales revenue queries already
allow only confirmed active statuses. The pipeline intentionally retains distinct
cancelled and draft status groups, but its common totals previously added those
amounts into confirmed sales. Pipeline currency totals now include only CONFIRMED,
SENT_TO_RESERVATIONS, IN_PROGRESS and COMPLETED. Cancelled-only scope has no
confirmed-sales total, while its separate row keeps the actual cancelled amount.

Legacy revenue, profit, agency and attributed-sales projections also reject
CANCELLED order facts before grouping, pagination, totals and exports. Historical
receipt/refund and dedicated cancellation report populations remain unchanged.
New regression covers mixed states, cancelled-only scope and matching preview/export
totals. No schema, migrations, business-data mutations or deployment.

Validation: Prettier ran. Test and lint commands could not start because this
checkout's reused API dependency junction no longer exposes the executables.
An attempted local junction repair was blocked; no workaround was attempted.
Do not claim test success or production activation. Restore normal dependencies
and require focused/full CI gates before publication/merge/deployment.
