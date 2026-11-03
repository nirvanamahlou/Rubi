# Workbench fixes — 2026-11-03

COMPUTER_ID=PC-B. Owner authorizes push and develop merge. Branch:
`codex/pc-b-workbench-fixes-1103`. No schema, migration or dependency changes.

- Calendar: place the call-center category exclusion on the related ticket,
  rather than the referral model. Verified with a real PostgreSQL query.
- Daily packages: allow pending PDF scans only through the existing fixed
  Workbench daily-package source boundary, preserving branch/type/source,
  confidentiality, archive and audit checks. Infected, quarantined and failed
  scans remain blocked. The Workbench preview button is immediately available.
- Attendance: Workbench permits every authenticated employee to read their own
  device-derived attendance projection without requiring general HR access.
  Other HR details retain their permissions. The existing Radan ingestion,
  schedule and explicit employee/user association remain authoritative; there
  is no name-based identity matching or operational account reassignment.
- Messaging: DELETE removes the caller's membership; for groups this is leave.
  The next remaining member becomes owner when an owner leaves. Direct chat
  identities remain stable and a new incoming message restores the recipient's
  conversation. Group membership is never restored by a send. Membership
  changes and sends serialize on the conversation row. PATCH allows current
  group owners to rename and add validated contacts in the group's branch.
  Clicking the group title shows its members and the owner's editing controls.
- Requests: DELETE creates an idempotent personal inbox-removal event. The
  caller must be the request sender or recipient in an authorized branch.
  Requests and the counterpart's inbox remain intact.

Producer and consumer endpoints ship together; existing request/response
contracts are unchanged. Own English entries and generated catalogues updated.

Validation: 94 targeted API tests including actual PostgreSQL/HTTP messaging
and request lifecycle tests; 130 Workbench and i18n Web tests. Full API/Web
typechecks, scoped lint and API production compilation pass. The disposable
PostgreSQL database was created separately and all existing migrations applied;
no operational database was used for tests. Web production build also passes; final-head
hosted CI gates merge. No runtime rollout or real-device pull is
claimed by this source change.
