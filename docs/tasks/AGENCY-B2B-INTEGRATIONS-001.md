# AGENCY-B2B-INTEGRATIONS-001

## Objective

Complete the previously blocked Agency slice without creating a parallel agency
identity: Master Data remains the owner of `MasterOrganization` and its postal
addresses; B2B owns branch-scoped operational profiles, commercial agreements,
credit policies and agreed rates.

## Ownership and locks

- Owner: `PC-B`
- Branch: `codex/pc-b-agency-b2b-integrations`
- Pull request: [#98](https://github.com/nirvanamahlou/Rubi/pull/98) to
  `develop`
- Base: `origin/develop@092109d8b8c020c802a9ac3faa27f4f6571d2994`
- Migration owner: `PC-B/AGENCY-B2B-INTEGRATIONS-001`
- B2B shared-contract/root export owner: `PC-B/AGENCY-B2B-INTEGRATIONS-001`
- Central docs owner: `PC-B/AGENCY-B2B-INTEGRATIONS-001`
- Dependency/lockfile owner: `RELEASED / UNASSIGNED`

The product owner explicitly stated on 2026-09-05 that the former PR #90 blocker
is resolved and asked PC-B to implement this slice. The handoff is recorded on
PR #90. Its branch, migrations and Sales implementation remain read-only.

## Domain boundaries

- Master Data owns organization identity, roles, contacts and addresses.
- B2B owns agency operational profile, B2B agreement, credit policy and agreed
  rate.
- Sales and Finance data are never queried through their Prisma delegates or
  repositories. Cross-module values are obtained through versioned public ports.
- Finance owns current exposure; B2B only owns the approved limit and policy.
- Documents continues to own uploaded logo binaries; Master Data stores only the
  stable logo file reference.

## Proposed persistence

- `MasterOrganizationAddress`: organization/country/city foreign keys, label,
  address line, postal code, primary flag, active/version/audit fields.
- `AgencyOperationalProfile`: organization and branch foreign keys, lifecycle
  status, account-manager reference, active/version/audit fields; unique per
  organization and branch.
- `B2bAgencyAgreement`: profile foreign key, generated public code, date range,
  lifecycle status and optimistic version.
- `B2bAgencyCreditPolicy`: profile foreign key, Decimal limit, currency code,
  date range, active/version/audit fields. Exposure is not duplicated.
- `B2bAgencyAgreedRate`: profile foreign key, service reference, pricing method,
  Decimal value and optional currency code, date range and version.

All timestamps are UTC, monetary numbers are Decimal, and every relation inside
the owning schema uses a real foreign key. Deactivation is preferred to deleting
referenced business records.

## Load and service assumptions

- Read/write ratio: approximately `20:1`.
- Peak request volume: below `50 QPS` for the current two-company deployment.
- Data classification: organization contacts are PII and stay masked by default;
  agreements, limits and rates are internal financial data.
- Proposed latency targets: p50 `<150ms`, p95 `<300ms`, p99 `<600ms`.
- Proposed availability and recovery: `99.9%` SLO, RPO `<=24h`, RTO `<=4h`.

These are reviewable design assumptions for this work item, not production
commitments.

## Acceptance criteria

1. Agency identity is always an existing organization with the `AGENCY` role.
2. An agency profile is visible only in an actor-authorized branch.
3. Address writes validate the country/city structural relation.
4. Agreement, credit policy and agreed rate writes are optimistic and audited.
5. Current Finance exposure is explicitly unavailable when the Finance public
   port has no result; it is never fabricated as zero.
6. The agency popup consumes public Master Data and B2B APIs and shows masked
   contact data, primary address and operational/commercial details.
7. Contract tests protect the versioned DTOs and boundary tests reject direct
   Sales/Finance repository access.

## Delivery status

- Implemented an additive migration for organization addresses, branch-scoped
  agency profiles, agreements, credit policies, agreed rates and B2B audit
  events. No Sales or Finance table is referenced.
- Published versioned B2B contracts and IAM permission codes. The API enforces
  authenticated permissions, authorized branch scope, optimistic versions,
  UTC/date ranges and audited writes.
- Added Master Data organization-address endpoints with a real city/country
  integrity check and one active primary address per organization.
- Connected the existing Agency popup to the public Master Data and B2B APIs.
  It shows masked contacts, base address, branch profile, agreements, credit and
  rates; the shared Persian/Gregorian DatePicker is used for every date.
- Finance exposure is consumed only through `FinancePartyExposurePortV1`. Until
  Finance registers a producer adapter, the UI reports `UNAVAILABLE`; it never
  invents a zero balance.

## Database review

The schema-analysis input is stored beside this document. The bundled analyzer
confirmed six primary-keyed tables and eleven foreign-key relationships. Its
JSON parser does not ingest the declared index arrays, so its missing-index
output is a tooling false positive; the Prisma schema and SQL migration contain
the query/FK-supporting indexes and were reviewed directly.

All repository migrations, including `20260905150000_agency_b2b_integrations`,
were then applied in order to a new disposable PostgreSQL database. The six new
tables, constraints and twenty-two indexes were verified, after which only that
disposable validation database was removed.

## Validation

- Prisma format, validate and generate: passed.
- Monorepo lint and typecheck: passed.
- Targeted migration, B2B/Master Data contract, API-boundary and Web
  integration tests: 21 passed.
- Web production build: passed with 34 routes. API and Worker builds also passed
  in the full build run.
- The full test run passed every changed package and all B2B tests. One existing
  Windows-only Customer Workspace source-text assertion remains red because it
  matches LF whitespace against a CRLF checkout; neither Customer file is
  changed by this task.
