# Caller ID name default — 2026-10-22 — PC-C

Owner explicitly authorizes prefilling the existing popup contact-name field from the incoming caller's display identity. Approved layout is unchanged; no technical controls or synthetic calls are added.

AMI CallerIDName (lowercase after frame parsing) is normalized into optional internal callerName. Existing v1 producers omitting it retain their original event shape. Native queue capture takes the external incoming anchor name only, never a later agent leg's name. Custom NoraCall events may optionally supply calleridname. No assumed CDR endpoint or PBX/dialplan change.

Names are trimmed, bounded to160 characters and reject control/bidi characters, numeric-only identities and common unknown/withheld placeholders. The value is unverified provider metadata, never used for authentication, customer matching, recipient selection or routing. It travels inside existing encrypted event/technical storage and the existing authorized attention response. No new plaintext field or migration.

Popup default uses saved call name first, otherwise incoming provider name; automatic and manual queue selection share the helper. Polling updates the current technical snapshot but never overwrites an in-progress draft. An operator can edit/clear the default; only the existing explicit SAVE stores it. Historical events without names remain supported; no retrospective backfill.

Validation: API caller-name/native/validation15 tests pass, with8 PostgreSQL tests explicitly skipped (no new real-database claim). Web default helper2 tests pass. API/Web types, scoped ESLint and contracts/API/Web production builds checked. Real PBX CallerIDName-to-browser acceptance requires an authorized incoming call and logged-in operator; no real call, extension mapping, grant, database fixture or PBX activation is performed by this task.
