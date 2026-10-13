# Assistant controlled tool infrastructure

Owner PC-C; base develop598fc90c; branch codex/pc-c-assistant-tool-registry-1013.
The human approved the continuation plan and chose tool infrastructure first,
localhost delivery, no real model traffic, subsequent three-scenario filters up
to90 complete Tehran days and current-session-only conversation. Company filter
is deferred until contractual company ownership is defined.

## Delivered candidate

Six immutable tool contracts centralize fixed read routes, permissions, scope,
empty strict input, output validation/projection, errors and limits. All source
reads now use one executor. ERP transport only exposes identity and registered
tool IDs. Native IAM is checked before and after each tool; branch removal during
a read and permission/session revocation withhold the result. Existing aggregate
release checks remain. No client-supplied identity or scope is accepted.

Server composition, authorization, transport, personal projection and minimal
allowlisted audit are separate modules. The three existing public v1 actions,
SELF snapshot, rate/concurrency/time/body caps and explicit unavailable/denied/
partial semantics remain. Audit tool IDs now consistently use registry IDs.
README contradictions about corporate sources and blocked actions are removed.
CI discovers all assistant test files and syntax-checks all native modules.

No database, migration, dependency, native IAM grant, ERP producer or Web source
change. No model provider, persistence, business write or shared-runtime restart.
The service uses native MJS: it has no TypeScript compilation/build target.

## Acceptance evidence

- Baseline28 HTTP tests passed before changes.
- Candidate41 tests pass: existing HTTP isolation/money/source validation plus
  registry immutability, input rejection, executor denial/revocation, byte caps,
  fixed routing and audit field minimization.
- All MJS syntax checks and5 CI-policy regressions pass.
- A count-coupled revocation fixture now revokes after the actual corporate read;
  increased pre/post authentication must not make this test revoke too early.
- Local Windows ephemeral ports can hit Fetch's forbidden list; the test harness
  rebinds only rejected candidates, without changing service ports or Fetch policy.
- Formatting, scoped lint, full final-head CI and merged-tree CI gate release.
  The main CI includes existing isolated PostgreSQL/API/assistant/Web integration.
- Synthetic correctness is not manager approval of real business data.

## Release and rollback

Publish as Amin-tech11 to develop only after all head checks pass. Verify merged
checks before replacing loopback4300. Core4000, ERP-read4301, Web3000 and database
remain unchanged for this unit. Record process/commit and health/anonymous401
smoke outside Git; rollback restores the prior assistant revision and environment.
No database rollback is needed. Final CI/runtime evidence belongs in the PR and
local handoff; this candidate document does not assert those gates have passed.

## Next units and gates

1. Versioned filters in owner APIs, then assistant/BFF/UI: max90 days, prior
   equal-length period, valid route IDs and authorized branch; preserve v1.
   Current balances remain as-of-now, not historical balances or due schedules.
2. Orchestrator and session-only chat using a fake provider in tests. Real model
   connection requires approved processing fields/location/retention/cost first.
3. Business reconciliation and pilot; Finance source, final access matrix, audit
   retention and data-driven balance rules remain explicit owner inputs.
4. RAG/events/financial metrics/forecast/news/write tools require their own sources,
   authorization, tests and release reservations; not part of this refactor.
