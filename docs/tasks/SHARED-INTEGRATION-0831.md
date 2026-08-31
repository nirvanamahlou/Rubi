# SHARED-INTEGRATION-0831

Status: IN_PROGRESS. Integration owner: PC-A. Date: 2026-08-31.

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

Pending. No claim of approval, merge, or PC-B local synchronization yet.
