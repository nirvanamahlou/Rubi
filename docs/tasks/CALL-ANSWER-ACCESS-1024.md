# Call Center answered-contact access — 2026-10-24

Status: design confirmed; implementation and production verification pending on the server-connected PC.
COMPUTER_ID=PC-C. Base develop63d73566.

## Confirmed policy

Only a trusted provider ANSWERED event establishes answered-call responsibility.
Ringing, offered calls, popup claims and manual outcome text are not evidence.
Every answering employee remains responsible after transfer; responsibilities
are additive, including multiple mapped employees sharing an extension and
multiple extensions belonging to one employee. An extension without an ERP
account grants nobody access. No account is created implicitly.

Employees see contacts for which they have answer responsibility. Managers also
see responsibility belonging to their own unit. Unit identity includes company;
the two companies' Sales units are distinct. Units without managers do not receive
an inferred manager. The explicitly approved executive and demo accounts see all
units and branches within Call Center. Other ERP permissions are not widened.

Production includes historic calls and contacts where durable answer evidence
exists. Missing historic evidence must be reported, never inferred from ringing,
display labels or a manually entered operator. Backfill must be repeatable and
preserve contact payloads, call history and manually assigned ownership.

Localhost remains available for full testing: do not apply production account
restrictions or historical ownership writes to the local operational database.
Environment selection must be server-side, never a Host header or browser flag.

## Implementation boundary

IAM owns account identities, organizational membership and access grants; HR owns
personnel/unit records. Customer Affairs owns many-person call responsibility;
Integrations supplies trusted normalized answer events via the existing public
projection port. Use real FK references, UTC timestamps and idempotent writes.
Preserve manual owner CAS/audit and separate request execution ownership.

Keep approved UI and the disabled global telephony widget unchanged. A read-side
restriction must cover list/search/detail/history/recordings, not just table rows.
Historic reprojection must not replay PBX commands, offers or business edits.

## Rollout prerequisites

Resolve approved usernames to actual active server user IDs, and unit names to
server unit IDs; personnel mappings remain outside Git. Verify branch membership,
exclusive roles, server version, backup and pending migrations before applying.
The user explicitly confirms this device has no production connection; rollout is
performed on another PC. No application, schema, permissions or operational data
were changed here. Source reservations are released for that PC to continue.

Acceptance: own/peer/foreign-unit/foreign-branch isolation; manager self plus team;
executive/demo complete scope; shared extension; two own extensions; transferred
call retains both employees; ring-only denial; duplicate/out-of-order answers;
historical repeatable backfill; all affected read endpoints; local test access.
