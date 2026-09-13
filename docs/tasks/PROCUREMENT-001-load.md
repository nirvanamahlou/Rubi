# PROCUREMENT-001 — isolated list load evidence

The final measured primary list workload and all three diagnostic workloads
meet P95 < 2,000 ms after index and narrow-row pagination repairs. Earlier
deep-page failures are preserved in the baseline and indexed-only evidence.
These measurements invoke the real `ProcurementService.list` method through
`tsx`; they do not measure HTTP, authentication middleware, browser rendering,
or end-to-end client network latency.

## Method

- PostgreSQL 18.1 in task-owned container `rubi-procurement-001-pg18`, bound only
  to `127.0.0.1:55473`; dedicated database `procurement_001_load_test`.
- Exactly 100,000 synthetic requests and 100,000 normalized request items,
  five branches, 100 synthetic users, 20 units and the nine published statuses.
  PostgreSQL `generate_series` and deterministic UUIDs created the fixtures;
  generation took 167,116 ms. No business records or credentials were copied.
- Average draft JSON size: 1,094 bytes. Indexed request relation size: 197 MB.
  Fixtures contain list data, not complete downstream commercial histories.
- Real service and Prisma queries; synthetic permission-scoped actors;
  in-memory HR unit lookup. Master Data, IAM, Documents, policy, operations
  and notifications adapters are unused by these list scenarios.
- 50 concurrent callers, default-equivalent PostgreSQL connection pool of 10,
  five warmup calls per scenario. Primary workload: 500 calls, equally split
  between first page and status-filtered first page. Own/unit/page-350
  diagnostics: 100 calls each, also with 50 concurrent callers.
- Parent's heavy build/test commands finished before measurement. All three runs
  used the same dataset, concurrency and workload. The final harness also
  captures both query plans for the new two-stage deep-page fetch. Normal desktop
  apps/light browser QA remained possible; this is not production capacity proof.

## Final-source results (milliseconds)

| Workload | Calls | P50 | P95 | P99 | Errors | SQL queries |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Primary mixed | 500 | 322.61 | 1118.64 | 1365.12 | 0 | 500 |
| Own scope | 100 | 225.05 | 304.10 | 317.42 | 0 | 100 |
| Unit scope | 100 | 198.74 | 278.84 | 295.27 | 0 | 100 |
| Page 350 | 100 | 270.72 | 351.77 | 385.28 | 0 | 200 |

The final run completed at `2026-09-13T13:54:20.110Z` using Node v24.18.0.
The primary P50 <= 500 ms and P99 <= 3,000 ms diagnostic targets also passed.
Primary P95 varied between runs despite unchanged first-page query shapes;
the final-source run is reported rather than substituting the fastest sample.

## Preserved intermediate results (milliseconds)

| Workload | Baseline P50 | Baseline P95 | Baseline P99 | Indexed P50 | Indexed P95 | Indexed P99 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Primary mixed, 500 calls | 1029.00 | 1580.88 | 1694.38 | 211.90 | 390.40 | 454.93 |
| Own scope, 100 calls | 328.46 | 416.65 | 460.94 | 470.99 | 753.19 | 811.26 |
| Unit scope, 100 calls | 1248.96 | 1667.89 | 1760.51 | 172.61 | 211.50 | 219.88 |
| Page 350, 100 calls | 8611.36 | 12088.05 | 12361.58 | 4752.60 | 5922.71 | 6072.87 |

Both intermediate runs had zero errors and exactly one SQL query per service call: 500 in
the primary workload and 100 in each diagnostic. The own-scope run varied
upward despite unchanged query shape, illustrating desktop benchmark noise;
it remains below the primary target. No claim is made that every workload
improved or that every page meets P95 < 2 seconds.

## Query findings and implemented repair

Baseline first-page and unit queries scanned all 100,000 requests and sorted
matching rows. Migration `20260913140000_procurement_scoped_list_indexes`
adds `(branchId, createdAt, id)` and `(branchId, unitId, createdAt, id)` indexes.
Post-change EXPLAIN shows the first-page and unit queries reading 51 rows
through their matching indexes; the status query retains its existing
`(branchId, status, createdAt, id)` index.

With indexes alone, page 350's OFFSET of 17,450 still caused a parallel scan
and wide-row external merge with temporary disk I/O. That intermediate P95 of
5,922.71 ms **did not meet** the 2,000 ms target.

The parent then changed service pagination for pages after page one to select
scoped IDs first and fetch at most 51 full rows, reapplying the authorization
predicate. The final deep-page plan uses an index-only scan over narrow IDs
(17,501 index entries, one heap fetch), then an indexed fetch of 51 full rows.
Neither stage used temporary blocks. This reduced measured page-350 P95 to
351.77 ms, with two bounded SQL queries per call. OFFSET remains linear in the
number of skipped index entries; arbitrary larger datasets/pages were not tested.

## Migration, integrity and seed verification

All 64 repository migrations applied successfully to a separate, newly empty
`procurement_001_migration_64_test` database; `prisma migrate status` reported
up to date. Prisma contains 26 Procurement models, delivered through four
additive Procurement migrations.
After applying the index migration to `procurement_001_test`, all 14 actual
PostgreSQL integrity tests passed (2.71 seconds). Prisma validation passed.

The standard seed ran twice after the final 26-permission Procurement catalog.
Both runs produced identical counts:

| Permissions | Roles | Role permissions | Users | Customers | Currencies | Procurement requests |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 158 | 8 | 249 | 1 | 2 | 2 | 0 |

Direct database verification found exactly 26 Procurement permissions and
zero Procurement permissions granted to the `administrator` role.

## Reproduction and artifacts

- [Executable harness](PROCUREMENT-001-load.ts)
- [Baseline measurements and complete query plans](PROCUREMENT-001-load-baseline.json)
- [Indexed-only measurements and complete query plans](PROCUREMENT-001-load-indexed-only.json)
- [Final-source measurements and complete query plans](PROCUREMENT-001-load.json)

Load only the task's synthetic **load-database** environment into the process,
then recreate its empty database and execute from the repository root:

```powershell
docker exec rubi-procurement-001-pg18 createdb -U procurement_test procurement_001_load_test
pnpm --filter @rubi/database exec prisma migrate deploy
pnpm --filter @rubi/api exec tsx --tsconfig tsconfig.json ../../docs/tasks/PROCUREMENT-001-load.ts --prepare-only
pnpm --filter @rubi/api exec tsx --tsconfig tsconfig.json ../../docs/tasks/PROCUREMENT-001-load.ts --measure-only
```

The harness rejects other hosts, ports, database names and missing explicit
`PROCUREMENT_LOAD_TEST=1`. `--prepare-only` creates fixtures only in an empty
dedicated load database; it refuses to replace an unexpected dataset.
`--explain-only --measure-only` inspects plans without a concurrent benchmark.
After capturing all evidence, the benchmark database and the newly empty
migration-verification database were removed, after confirming they had no
active clients. Their deterministic fixture harness and migration inputs remain
available for reproduction. The task container and its `procurement_001_test`
and `procurement_001_api_test` databases remain intact. No shared runtime or
existing task-test fixture database was reset or removed.
