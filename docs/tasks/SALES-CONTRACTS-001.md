# SALES-CONTRACTS-001

- Status: `IN_PROGRESS / PERSISTENCE_BLOCKED`
- Owner: `PC-A`
- Branch: `codex/pc-a-sales-contracts`
- Base: `origin/develop@708ffb6f87598f0a92925399e9d3cc3ed0ec73a6`
- Worktree: isolated from the dirty primary workspace

## Reserved scope

- Sales Contracts module under `apps/api/src/sales/**` and `apps/web/src/modules/sales/**`
- Existing Sales routes under `apps/web/src/app/(crm)/sales/**`
- Module-local contracts, Sales tests, and this task-local document
- Cross-module access only through public contracts/ports; no direct table query or internal infrastructure import

## Lock state at start

- `Migration Owner`: held by `PC-B/DOCUMENTS-004-OPERATIONS` on
  `origin/codex/pc-b-documents-workflows@ba1aea9`; this task will not add Prisma
  schema, migrations, seeds, or substitute/fake persistence until the lock is released.
- `Central Docs Owner`: held by the same work item; `WORK_ASSIGNMENTS.md`,
  `docs/PROJECT_STATUS.md`, and `PLANS.md` remain unchanged during this phase, so the
  reservation is recorded only in this task-local document.
- `Dependency/Lockfile Owner`: `RELEASED / UNASSIGNED`; this task does not reserve it
  and will not change dependencies or lockfiles.
- `Sales shared-contract`: remains module-local until producer/consumer coordination
  and the central-file lock permit publishing under `packages/contracts/**`.

## Non-interference boundary

- PR #85 and all Customers/Documents files in it remain unchanged.
- PC-B Master Data/Documents work remains untouched: no merge, cherry-pick, copy, or rewrite.
- No direct changes to `main` or `develop`; merge and force-push are prohibited.
