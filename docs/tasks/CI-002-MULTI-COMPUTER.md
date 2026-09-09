# CI-002 — Multi-computer CI

Owner: PC-B. Base: develop `679e516`. Branch: `codex/pc-b-ci-multi-computer`.

The owner reports four development computers and requests checking CI for the expanded team, fixing gaps, then pushing and merging. Support all four (including any three-computer subset); do not infer IAM accounts, repository collaborators, module transfers or access grants.

## Findings and scope

- Existing push filters name only PC-A/PC-B. PC-C/PC-D pushes are not covered.
- Pull-request branch filters describe the **base**, not the source. PRs from any source to develop/main already run; stacked PRs targeting PC-C/PC-D branches need coverage too.
- Existing event-plus-head-branch concurrency separates task branches. All four jobs use independent GitHub-hosted Ubuntu runners, not a developer computer; their PostgreSQL service is disposable. No four-machine job matrix is needed.
- Widen the same branch filter to `codex/pc-*`; retain main/develop and all quality/security gates. Add dependency-free policy regression checks for A/B/C/D, future computer IDs, PR bases and concurrency isolation.
- Align the active contributor instructions with four IDs while preserving existing module owners and exclusive shared-file/migration/dependency reservations. Historical task reports remain historical.

Only `.github/workflows/ci.yml`, `.github/tests/ci-policy.test.mjs`, `AGENTS.md`, `docs/DEVELOPMENT_WORKFLOW.md`, this report and this task's status/assignment entries are reserved. No application code, schema, migration, seed, dependency/lockfile, local runtime, database or credentials are changed.

## Verification and handoff

Five local policy regression tests and Node syntax checking passed. The baseline develop CI at `679e516` is green. Separate open PC-A UI PR failures are formatting/application-test failures, not evidence of computer-count concurrency failure; their branches are not modified by this task.

Run `node --test .github/tests/ci-policy.test.mjs`, Node syntax checking, scoped Prettier, Markdown links/fences and `git diff --check`. Require the existing full quality, test, database and production-build jobs on the final PR head and verify the develop run after the explicitly authorized merge. Push normally and retain source branches.

Each computer must fetch the merged develop and create a unique task branch from it. Older branches retain their old workflow until they receive the update. Branch naming is lowercase `codex/pc-<id>-<task>` with `COMPUTER_ID=PC-A`, `PC-B`, `PC-C` or `PC-D`; do not share a writable task branch. This is CI configuration verification, not proof of local setup or repository access on machines that were not inspected.

References: [GitHub branch filter semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onpull_requestpull_request_targetbranchesbranches-ignore), [workflow concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).
