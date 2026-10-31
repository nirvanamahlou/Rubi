# CALL-RECIPIENT-ALIAS-1031

COMPUTER_ID=PC-C. Scope: production recipient investigation and explicit additional-extension registration. Source base e57ad2435 preserves the published own-extension popup work. No existing HR source, schema, IAM grants, PBX routing, call answers or deployed images changed.

## Findings and repair

- Case A had a provider-confirmed answer on an extension absent from the HR employee directory. The same employee already had a different internal. The owner explicitly confirmed both belong to the same employee.
- Registered the second internal through the HR-owned bounded administrative contract in `scripts/hr/additional-extension.mjs`. The original record remains unchanged. Registration uses a freshly authenticated IAM session, `hr.manage`, exact branch/employee/primary preconditions, advisory/employee locks, a serializable transaction, an audit event and HR notification. Existing assignments to another employee are rejected; shared identities are never guessed or overwritten. Replay returns the same record without another write.
- Production CallCenterService.hydrateDestinations now returns the complete current-directory label for the actual Case A call, preserving the provider answer timestamp. Both physical internals resolve to the same employee. No historical account access was backdated. Routing grants and pending historical ownership are separate from display hydration.
- Case B was verified against exact PBX linkedid, not a time/phone guess. CEL contains only the external channel start, PBX Answer, hangup/end and linkedid end. There is no internal channel or bridge. CDR records eight billed seconds on the external leg; its ANSWERED disposition is the PBX answering, not evidence of an employee answering. ERP correctly has no recipient for this call. Do not populate a guessed person or outcome.

## Validation

- Six targeted Node tests pass: addition/replay preservation, authorization/branch denial, conflicting employee, stale primary, inactive/unlinked employee, invalid input.
- Production authenticated preflight passed; addition and idempotent replay verified. Current directory resolves both internals and actual production call projection returns the complete label.
- Existing API/Web services and localhost runtime were not replaced. The operation is JavaScript maintenance code, outside application compilation; syntax and formatting checks apply. No migration or application build is needed for this data-only correction.
- Real phones, employee IDs, account/session IDs and PBX credentials remain outside Git. The copied temporary command module was removed from the API container after validation.

## Limits

This maintenance operation adds a confirmed internal to existing HR records. It is not a browser endpoint or a general extension editor. It does not assert historical individual identity, change answeredAt, resolve unanswered calls, or create/reassign follow-up responsibility. Future telephony routing still uses the existing authorized Integration/HR contracts.
