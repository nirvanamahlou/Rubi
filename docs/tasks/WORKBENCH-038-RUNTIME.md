# WORKBENCH-038 runtime activation

User authorized activation on Web3100. A separate runtime branch combines
WORKBENCH-038 (`4694d85f`) with the currently running Customer Affairs implementation
(`b1da23bd`), preserving its forms, date filters, site bridge, reminders and SMS
transport. Workbench request producer methods and clients are retained. The latest
staff-picker/date-label changes from `299a48bc` are also included.

The production database is `nora_hr_current_20260908` at local port 55432; document
storage remains `C:/Users/admin/AppData/Local/Nora/hr007-documents`. Credentials are
read from the existing environment file, never committed or printed.

A full custom-format backup was saved outside Git to
`C:/Users/admin/AppData/Local/Nora/backups/workbench-038-before-activation.dump`.
Prisma successfully applied only the two outstanding released migrations:
`20260912200000_workbench_integrations` and
`20260912213000_master_manifest_destination_airport_optional`. No seed or demo loader
ran, no data was deleted, and the existing API remains compatible.

API build/typecheck passed. Combined API tests passed 103 tests, with the repaired
date-filter suite passing another 5. Web build produced 46 routes. Combined Web
tests passed 94 tests and one date-filter rendering test timed out under parallel
build load; all 3 tests in that suite passed in isolation. The API candidate on 4338
returns health 200 and protects the performance endpoint with 401 without a session.
Its reminder worker is disabled during validation.

Activation is pending: automatic approval review rejected the attempted replacement
of the shared API with `blocked by policy`, before executing it. The original
processes were left running. Meanwhile the Customer Affairs task replaced its own
runtime; most recently observed owners were Web3100 PID2416 and API4190 PID17612.
Recheck process identity immediately before any owner-approved replacement. Launch
the new API using this checkout's `infrastructure/scripts/start-hr-api.mjs` with the
same environment/database/documents arguments; launch this checkout's production
Next server on 3100. The running Customer Affairs checkout remains available for
rollback. No remote branch was merged by this activation task.
