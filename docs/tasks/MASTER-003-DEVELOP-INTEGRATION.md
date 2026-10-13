# MASTER-003-DEVELOP-INTEGRATION

Owner: PC-B. Date: 2026-08-31. Target: `develop`.

The owner explicitly requested pushing all current changes and merging into dev
(the repository's `develop` branch). This supersedes the previous no-merge limit
for this integration, not the restrictions on force push, deleting source branches,
changing main, or modifying application databases.

## Exact inputs and preservation

- Base `e25f2886c3e6d7e90c33ef27604bdce76dc973f0`, merged PR #58: combined
  Customers #56, Ticket Catalog #46 and Master Data #55 with its ancestors.
- Source `b04c2bd7c31b6ef85ed7357d83f4c5f548183d12`, PR #59. Adds only
  `6abd960` (#57 demo fixtures), `d59fc64` (catalog usability) and `b04c2bd`
  (safe realistic-demo refresh) beyond the already integrated #55 snapshot.
- #54 already contains the separately developed transport #47; its compatibility
  fixes are preserved. That old transport branch is not independently reapplied.
- Branch `codex/pc-b-master-data-develop-integration` starts at #58 and merges
  the exact #59 history, without rewriting either source branch.
- Conflicts were limited to WORK_ASSIGNMENTS, PROJECT_STATUS and DECISIONS;
  both sides' entries were retained. Historical no-merge/deployment statements
  describe their earlier tasks, not this owner's later integration authorization.
- No Customers, IAM, Calendar, dependency/lockfile, or old migration changes
  relative to the combined develop baseline. In particular, #58's XLSX security
  fix and tests, shared route tests and PostgreSQL test-target helper are retained.
- The new demo test accepts an explicit environment-file path, like the existing
  integration tests, so this isolated worktree does not require copying private keys.
  Its loopback/port/random database guards and fixture-tool restrictions remain intact.

## Verification of the combined tree

- Frozen install, Prisma format/validate/generate, full lint and typecheck passed.
- Full production build passed: Web, API, Worker and packages; all eight Master
  Data sections plus the existing Customers/Ticket Catalog routes are present.
- 1,257 ordinary tests passed without cached test results: API 667, Web 510,
  Database 61, Contracts 16, Config 2 and Worker 1. The 66 opt-in PostgreSQL tests
  were skipped in that ordinary run and separately executed, not counted as passes.
- All 66 real PostgreSQL tests passed: nine demo/filter/status/constraint tests
  in a random isolated database, and 57 tests in six suites on a dedicated
  loopback-only PostgreSQL 18 container, run serially.
- All 27 migrations deployed to an empty PostgreSQL 18 database. Seed ran twice
  serially. The only new migration relative to develop is
  `20260831140000_master_country_display_order`; all 26 historical migrations
  remain byte-for-byte unchanged. Its rollback file is operator-only and was
  exercised solely by the disposable-database test, never on the application DB.
- One early typecheck invocation omitted the required validation-only DATABASE_URL;
  rerunning with that non-connecting value passed. No production configuration was
  changed to accommodate tests.

## API compatibility review and documentation debt

The `api-design-reviewer` tools were run on generated Swagger metadata. Baseline
metadata substitutes the two original DTO modules from `e25f288`; controllers and
Swagger configuration are unchanged, and every other metadata input is the combined
develop version. Runtime behaviour is additionally covered by DTO/HTTP/database tests.

| Tool output | Baseline | Combined |
| --- | --- | --- |
| API linter | 64 endpoints; 0 errors, 128 warnings, 67 informational findings | Identical |
| Breaking-change detector | — | 0 changes detected; `hasBreakingChanges=false` |
| API scorecard | 47.7 / F | 47.7 / F |

The optional B-grade documentation target **did not pass**; no clean whole-API
design sign-off is claimed. Existing Swagger descriptions, response schemas and
pagination metadata are incomplete, so its identical output alone cannot prove
runtime compatibility or describe the new optional filters. The TypeScript contract
adds only optional query fields, and the actual filter/status endpoints were tested.
This inherited documentation debt is recorded separately from the integration's
passing runtime/security/regression checks, not fixed by unrelated API rewrites.
Raw tool outputs are retained in the isolated worktree's ignored `tmp/api-*.json`.

## Runtime and merge handoff

- Authenticated combined runtime passed all 45 Master Data list endpoints,
  Customers list, create/read/two filters, country display order/dependency count,
  deactivate/reactivate, stale-version 409, real filtered XLSX and logout revocation.
  Production Web returned authenticated 200/RTL for all eight Master Data sections,
  the hub, Customers and Ticket Catalog (11 routes). This is HTTP/SSR smoke, not
  full interactive browser QA. Test-only container and databases were removed.
- Early smoke-script attempts used an unsupported country payload / unassigned
  ISO code; the API correctly rejected them with 400. The corrected valid fixture
  passed without modifying application validation or data.

- The user's original working tree was clean and already pushed when work began.
  The original checkout, source branches, application database, private settings,
  API4000 and Web3100 are not modified by this integration.
- Test databases use synthetic fixtures and random ephemeral credentials only.
  The test administrator exists only in the disposable database; no application
  user, password or session is reset or bypassed.
- Merge is through a normal PR to develop after verification, never direct push,
  force push or protection bypass. Source branches are retained. Confirm the actual
  GitHub merge result before reporting this task DONE/MERGED.
- The integration reservation ends on successful merge. Existing PC-B/MASTER-003
  development ownership is not transferred or globally released. Future work must
  begin from current develop and reserve its own scope.
- Local database content is not part of Git. Updating another PC's runtime and
  applying additive migrations there require a separate safe environment update.
