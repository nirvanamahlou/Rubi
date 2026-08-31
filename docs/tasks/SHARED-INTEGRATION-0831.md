# SHARED-INTEGRATION-0831

Status: READY_FOR_REVIEW. Integration owner: PC-A. Date: 2026-08-31.

The product owner requested a single product containing both PCs' published work.
The isolated worktree is for merge/testing safety only; delivery is through one PR
to develop. Source branches and existing working copies are not rewritten.

## Inputs

| Input | SHA |
| --- | --- |
| develop | 5f9cb723de39e29cff95f26b047138699bd36392 |
| Master Data PR #55 and published ancestors | 241308e45aead3fcea82cc08466ce60dde057f8c |
| Customers PR #56 | f0dd7922cc60bd61b8fc0487b2311867c5616888 |
| Ticket Catalog PR #46 | 86551ce447fb9af3d7fb49119498cee3c7e1ec2a |

PC-B's later demo-fixtures branch is not part of the selected PR #55 snapshot.
PR #54 already ports transport PR #47 with compatibility fixes; inspect retention
rather than blindly introducing a second competing transport implementation.

## Acceptance

- Preserve all existing Customers security fixes and Master Data workflows.
- Retain every input migration byte-for-byte, validate the combined schema, deploy
  to fresh PostgreSQL, and run seed twice plus real database integration tests.
- Run frozen install, lint, typecheck, full tests, production build, and authenticated
  smoke for Customers, Master Data and Ticket Catalog on the same runtime.
- Ticket Catalog remains Preview/Phase A: no operational capacity, issuance or
  persistence is implied. Final sale price belongs to Sales.
- Do not copy production or real passenger data into test environments or Git.
- Do not change global lock ownership, source branches, main, or private keys.
- A normal PR merge is allowed only after the combined review gates pass.

## Results

- Frozen install, full lint (6 tasks), typecheck (9 tasks) and 1,221 ordinary
  repository tests passed. All 57 opt-in PostgreSQL tests passed separately in
  six suites on the dedicated loopback container (none counted as passed while skipped).
- All 26 migrations deployed to an empty database; seed ran twice successfully
  when executed serially. The first concurrent seed attempt hit a local resource
  timeout; no production transaction limits were changed to hide it.
- Every input migration hash is unchanged. All 58 Master model definitions match
  PC-B's snapshot and all 22 other model definitions match develop (whitespace ignored).
- Additional diagnostic `prisma migrate diff` is NOT clean: inherited index/FK
  names differ from implicit Prisma names, and MasterLeader.destinations has an
  empty-array database default absent in the source schema. No structural model
  change was introduced by this integration. Names/default alignment is a follow-up
  for the existing schema owner, not an excuse to rewrite historical migrations.
- Production build: all 6 tasks passed (Web/API/Worker/packages), including all
  shared routes and the eight Master Data sections. No cached build was accepted.
- Authenticated same-origin smoke: 8 groups passed, covering all 45 Master Data
  list resources, finance/geography KPI requests, Ticket Catalog reference queries,
  all key Persian RTL pages, real XLSX output and session logout.
- Customer regression HTTP/database smoke: 11 checks passed, including real
  encrypted national-ID/contact persistence, masking, audited reveal, checksum,
  duplicate rejection, unrelated-edit preservation, branch tampering and 200/409
  concurrent mutation. Only synthetic data in the disposable database was used.
- The first XLSX smoke request incorrectly included pagination fields; the API
  correctly rejected it. The corrected documented export contract passed.
- Combined UI was checked via authenticated HTTP and rendered-component tests;
  no new full interactive browser QA is claimed.
- PR #46's existing IAM minimum-password change and dynamic Sales pricing handoff
  were retained and recorded centrally. Catalog stays Preview; pricing/issuance
  and the remaining Customer security backlog are not declared implemented.
- Final target is one develop. No final merge, PC-B update, application database
  change, or release of PC-B development locks is claimed before the merge result.
