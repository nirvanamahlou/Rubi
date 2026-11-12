# LEDGER-FISCAL-ALLOCATION-1112

Owner: PC-D. Task branch: `codex/pc-d-ledger-fiscal-allocation-1112`.

## Requested behavior

The owner confirmed direct entry of a year such as ۱۴۰۵. Ledger allocation now asks only for year, start date and end date. Remove the new-year checkbox and fiscal-year-title input. Add a removal button beside the allocation + button, acting on the selected row after confirmation.

## Implementation and preservation

- Normalize Persian and Arabic year digits in the UI and API. Resolve the existing active fiscal-year definition by code, preserving its title; otherwise create a definition whose title equals the year code in the same transaction as allocation. Legacy explicit year-ID/title commands remain supported.
- Retain company selection, branch authorization, date validation, overlap/duplicate checks, optimistic versions, book transaction locking, command replay and audit snapshots.
- Removal affects only an OPEN allocation without journals (including cancelled journals), general documents, statements or historical journal period references. Retain the fiscal-year definition. Restrictive foreign keys provide a final reference guard. No operational allocation has been deleted during development.
- Reject stale saves after removal instead of recreating the allocation. Reject stale/concurrent deletion. Editing an allocation uses the same financial-reference guard.
- No schema, migration, dependency or lockfile changes. No deployment, PR or merge for this task; commit and task-branch push follow the owner's standing instruction.

## Validation

Validation: 76 PostgreSQL core/company-ledger tests passed, including all eight company-ledger cases; focused Web/i18n checks and scoped API/Web lint passed. API/Web TypeScript and both production builds passed. PostgreSQL fixtures use the dedicated disposable local Accounting test database, never the restored operational database.

Browser acceptance is not claimed: the computer-use connection failed to initialize with a missing kernel-assets path. The running local application and production website have not been updated by this task.
