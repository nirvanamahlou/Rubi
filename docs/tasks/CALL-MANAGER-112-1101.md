# CALL-MANAGER-112-1101

COMPUTER_ID=PC-C; base origin/develop061f265a8. Scope: missing manager
extension112 popup delivery, without changing the approved UI or other active
Call Center work. The user explicitly declined inter-chat messaging.

## Root cause and production repair

- Read-only production inspection found one active HR employee with extension112
  linked to the intended active ERP account in the same native branch.
- The active real telephony connection had no mapping for that extension/account.
  The account had a live browser lease but zero telephony offers.
- Native IAM eligibility, Call Center route and own-snapshot checks all passed.
  Missing permissions or a broken HR account link were not the cause.
- At2026-11-01T14:03:04Z, the existing owning
  `TelephonyIntegrationService.mapping` command created the missing active
  mapping, version1. Its native `MAPPING` audit has a null before-state.
- A real inbound call produced an active own-account offer at14:04:41Z.
  Repeated preview confirms the mapping, scope and snapshot; repeated apply is
  a no-op and leaves version1 unchanged.
- The user explicitly confirmed that both incoming and outgoing calls now open
  the popup in the manager's browser. Both-direction acceptance is complete.

No account permissions, schema, historical calls, outcomes, PBX configuration,
images, environment or running services were changed by this repair. Concurrent
peer application releases were preserved. Old events were not replayed as new
popups. Production employee/account identifiers and call content are not stored
in this repository.

## Administrative helper

`scripts/call-center/repair-extension-mapping.mjs` runs as a separate maintenance
process against the deployed native application modules. It accepts a private
JSON plan on stdin containing phase (`preview` or `apply`), extension, username,
connectionId, branchId and expectedVersion. No input plan is checked into Git.

Preview checks the active real configured connection, exact active account and
branch, authoritative unique HR account linkage, nonshared destination, existing
route/access and the current mapping/version. It never compensates with grants,
overwrites a different recipient or changes historical ownership. Apply uses the
existing Integration service, which performs native authorization, version
checking, locking and audit. The CLI exposes no HTTP endpoint/session and starts
no PBX collector or application background timers.

This is not automatic provisioning. Future HR/account/extension changes must
still be explicitly validated before an administrator registers their mapping.
Browser popup acceptance requires that employee's authenticated ERP session and
a real call; a server-side snapshot alone is not browser acceptance.

## Verification

- Nine Node tests pass: absent mapping, idempotence, conflicting recipient,
  ambiguous/unlinked HR, inactive or changed account, missing existing access,
  inactive/synthetic/changed connection, stale version and malformed plan.
- `node --check`, scoped ESLint against the existing production toolchain and
  scoped Prettier validation pass.
- Production preview, owning-service apply, audited database postcondition,
  repeated no-op apply and native own-snapshot checks pass.
- User acceptance passes for incoming and outgoing calls.
- No API/Web runtime source or bundle was modified; no application rebuild or
  restart was necessary for the database-backed mapping to take effect.
