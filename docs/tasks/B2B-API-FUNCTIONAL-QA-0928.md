# B2B API functional QA — 2026-09-28

- COMPUTER_ID: PC-B; branch: `codex/pc-b-b2b-api-qa-0928` from `origin/develop@4013211f`, rebased without conflict onto `origin/develop@02cf09f6` after the first QA pass.
- The ordinary API suite passed on the rebased branch: 211 files, 1692 tests; 15 files and 175 tests were skipped by their environment gates. The B2B slice passed after the fix: 13 files and 127 tests; its PostgreSQL file and 19 tests were skipped.
- Found a replay edge case in the B2B agreement command repository. A retry with the same request ID returned the **latest** agreement even after a different command had advanced its version, making the old request appear to have produced the newer result. A replay after a later version now returns `B2B_COMMAND_RESULT_SUPERSEDED` (409); same-version retries remain idempotent. A focused regression test covers both cases without another write.
- API lint, typecheck, production build and targeted B2B tests passed.
- PostgreSQL persistence tests could not run here: Docker Desktop service is stopped and this session cannot start it. No operational database or runtime was modified. Run `NORA_RUN_B2B_POSTGRES_TESTS=1` with Docker and `postgres:18.1-alpine` available before claiming database-level form verification.
- The legacy `PUT /b2b/agencies/:organizationId/credit-policy` deliberately returns 409 pending the independent approval workflow. The current 360 `credit` view uses `AgreementWorkflowPanel`; the old form calling that endpoint is unreachable in the current route. No direct credit activation was added.
- No schema, migration, dependency, shared contract, grant or data change.
