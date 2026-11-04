# User section access repair — PC-B — 2026-10-22

## Authority and bounded scope

The owner asks to diagnose and repair Call Center/Integrations visibility for two
existing accounts on Avina using the previously authorized SSH method. This is a
bounded follow-up to delegated IAM work, not a transfer of general IAM ownership.
Base develop73ad32b5; branch codex/pc-b-user-section-access-1022. No dependency,
schema, API contract, UI redesign, session impersonation or password-reset change.

The prior Customer Affairs planning baseline and scope rules remain unchanged;
there is no new capacity or architecture recommendation in this repair.

## Diagnosis

- Both active accounts have exclusive v3 manual snapshots with the dedicated
  Call Center screen, the scoped policy marker and Integrations screens selected.
- The four pre-existing native Call Center permissions were absent from the
  deployed `iam_permissions` catalogue. They were present in the global seed,
  while the later scoped migration registered only the ten new scoped choices.
  Thus selecting the full group could not include the four omitted choices;
  native Call Center guards correctly denied the missing read/operations.
- Integrations authorization is not reproduced as broken: actual registry reads
  allow all nine sections in each of the five authorized branches for both users.
- The deployed navigation renders both links when consuming the actual stored
  permission sets. The browser probe intercepts only the actor response and blocks
  writes; it does **not** authenticate as either real user or prove their existing
  browser/session state. Call Center is under Sales; Integrations is under Company
  Settings. Existing menu grouping and collapsed-state behavior are preserved.

## Durable correction

`20261022070000_call_center_base_permissions` registers only the four baseline
native choices with `ON CONFLICT (code) DO NOTHING`. It does not grant or remove
any role/user permission, overwrite custom labels or rerun the global seed.
Existing installations can apply it repeatedly without privilege expansion.

The owner subsequently requests a general checkbox rule, not an account-specific
fix. The shared `completeManualAccessPrerequisites` function is now used by both
the existing manual editor (single check, group check and role-template choice)
and the transactional server save boundary:
The new manual-user creation boundary uses the same normalization before native
permission/screen delegation checks, so new accounts do not depend on a later edit.

- A checked Call Center view includes its native read guard. A newly selected
  view defaults to own contacts/reports reads only if no explicit scope was
  selected. It never invents team visibility, write, ownership or outbound grants.
- Selecting an Integrations child includes its root; a newly selected root alone
  includes the brands view. No sibling, settings operation or field is granted.
- Every added prerequisite passes the existing delegation ceiling and revision
  checks. A caller cannot gain authority by omitting prerequisites from the DTO.
- Existing legacy Call Center users retain scope on unrelated saves; deliberately
  removed own/team scopes are not restored. No existing-account blanket backfill
  or account-name-based authorization rule is added.
- The DTO/routes, role isolation, audit, UI design and organizational boundaries
  remain unchanged. The shared producer/consumer change requires API and Web
  rollout together; Git merge alone does not deploy it to Avina.

## Authorized production repair

After the concurrent approved full-develop rollout completed on73ad32b5:

1. Saved protected target manual snapshots/revisions and21 role fingerprints in a
   root-only operational directory outside Git, without password/session material.
2. Inserted the four missing catalogue choices transactionally with a dedicated
   audit event. No migration history was forged; the future insert-only migration
   is idempotent against these already-registered choices.
3. Reused `ManualUserAccessService.save` under the existing canonical active
   administrator, with each saved revision and unchanged title/screens/controls.
   Added only the four omitted Call Center operations to the two owner-named
   exclusive roles, consistent with the owner's full-section selection.
4. Re-read both snapshots; checked exact permission delta, preserved scoped marker,
   route authorization and all19 unrelated role fingerprints. Verified two normal
   manual-access audit records plus the catalogue repair audit.

No other user's grants, branch assignments, contact ownership, PBX settings,
business records, authentication secrets or operational application containers
were changed. Catalogue registration makes the choices available for subsequent
explicit admin selection; it does not assign them automatically to administrators.

## Verification and limits

General-rule follow-up: all208 Contracts tests pass, including five prerequisite
regressions; all101 prior user-editor regressions pass and the expanded6-test save
suite passes with three arbitrary user IDs. Real isolated PostgreSQL runs all187
migrations without seed and all6 IAM persistence tests pass, including three new
arbitrary users' checkbox save/revocation and unchanged unrelated-account revision.
The21 focused IAM policy/administration regressions also pass. The original2
catalogue tests and repeated-apply PostgreSQL proof remain valid. Scoped lint and
formatting pass; full hosted exact-head gates are still required before merge.

The first local PostgreSQL attempt ran while Docker was stopped/starting. Once
the existing QA container was ready, the new empty database migrated and passed;
no operational database was used and no timeout or security gate was relaxed.

- Database tests2, IAM policy/authenticated-permission tests31, Web full-section
  selection tests4:37 pass. Scoped ESLint/format/diff checks pass.
- Real disposable PostgreSQL18 proof applies the migration twice in a temporary
  shadow catalogue; existing custom label, unrelated permission and grant sentinel
  remain unchanged. The test transaction rolls back; no operational database used.
- First local Web run used stale ignored Contracts output; rebuilding the existing
  Contracts package made the unchanged tests pass. No test assertion/gate weakened.
- Database full typecheck/build attempts hit the explicit1024MiB local heap limit;
  these are not reported as passing. No production TypeScript source changed;
  exact-head hosted type/build gates remain required for this migration/test PR.
- Actual production `CallCenterService.list` succeeds for both users across all
  five authorized branches, including the real IAM/HR scope ports and decryptor.
  Registry reads similarly succeed for all nine Integrations sections. Results
  retain no returned contact/customer content in Git.
- Browser evidence is explicitly synthetic read-only actor injection with actual
  saved grants, not a real user login. No fabricated token or session was created.
  At1440px, both links have nonempty visible rectangles for both stored accounts
  after expanding their existing navigation groups.
- Final HTTPS API health and login return200. No call, note, request, outbound
  telephone operation or third-party integration write was performed as a test.
- Hosted exact-head quality/full-tests/build/migration checks remain publication
  gates; local checks are not claimed to replace the full hosted suite.

## Recovery

If the owner requests reversal, re-read each target's current revision and compare
against the protected after-state before restoring its prior selection through the
same IAM service; never overwrite a concurrent user's edit. Preserve repair audits.
Leaving registered permission choices is safe; do not delete permission rows which
may now be referenced. This migration has no destructive down operation.
