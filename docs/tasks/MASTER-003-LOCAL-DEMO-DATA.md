# MASTER-003-LOCAL-DEMO-DATA

Date: 2026-08-31. Owner: PC-B / MASTER-003.
Branch: `codex/pc-b-master-data-demo-fixtures`, from `241308e` / PR #55.
Scope: the user's explicit request for local test data throughout Master Data.

## Local result

78 synthetic records were created in 40 retained catalogs. Names contain
`آزمایشی`; search that term with status set to all. Counts below exclude join
rows and audit events; they are not hard-coded dashboard counts.

| Section | Records | Coverage |
| --- | ---: | --- |
| مالی و پولی | 8 | XTS currency, banks, branches, payment methods |
| جغرافیا | 9 | Country, regions, cities, airport, three terminal types |
| سازمان‌ها و تأمین‌کنندگان | 10 | Organizations, suppliers, brokers, services, protected contacts |
| اقامت | 11 | Hotels, chain, rooms, meals/services, facilities, composite hotel |
| حمل‌ونقل | 18 | Airlines, aircraft, cabin classes, baggage, draft manifest templates, rail/bus companies and types |
| بیمه | 6 | Insurers, plans, coverages |
| تور و خدمات سفر | 8 | Leaders, tour types, transfer types, visa service references |
| مراجع فروش | 8 | Acquaintance methods, sales channels, lost reasons, tags |

Relationships use actual local IDs and join tables. No real-world travel,
insurance, price or inventory claim should be inferred from these fixtures.
Country AQ and currency XTS pass the existing reference validation; the airport
and airline codes are explicitly demo identifiers, not asserted allocations.
Contact examples use only `example.invalid`; they go through existing encryption
and masking, including safe audit snapshots. There are no phone numbers.

Exchange-rate history/approval deliberately receives **no seed rates**, as
previously required. No CIP, lead source, customer type or campaign type is added
to the removed navigation catalogs. No account, IBAN, card, CVV, transaction,
contract, purchase limit, provider connection, document or external file is
fabricated. Manifest templates remain Draft with no external file reference.
Organization contacts support the partner profiles; no removed contact tab is
restored.

## Safe execution

- Separate opt-in CLI; not imported by AppModule, startup or the general Prisma
  seed. No public endpoint or authentication bypass is added.
- The target guard accepts only development/test, localhost/127.0.0.1, port
  55432, database `rubi` or the exact isolated-test naming pattern. Only optional
  `schema=public` is accepted; connection overrides are rejected.
- Existing MasterDataService validation and repository writes are reused inside
  one enclosing transaction. A PostgreSQL advisory transaction lock serializes
  this fixture batch. Any validation or collision error rolls back everything.
- New records receive normal create audits plus a separate
  `master_data.demo.seed` provenance marker keyed by `rubi-master-demo-v1/key`.
  Offline fixture actor IDs are reserved synthetic UUIDs, explicitly labeled as
  such. They do not represent an interactive human operation; no IAM user,
  branch, session, permission assignment or login token is created or changed.
- Reruns reuse only previously marked records, including user-edited fixtures.
  Existing records are never updated/deleted. An unrelated code collision or
  missing marked record fails explicitly instead of taking ownership or silently
  recreating it. No cleanup/delete command is provided.
- A private PostgreSQL custom-format backup was taken and its archive listing
  checked before operational execution. Backups and local environment settings
  are outside Git.

From the repository root, with the existing private local API environment:

```powershell
pnpm master-data:demo:preview
pnpm master-data:demo:apply
```

Preview executes the same validation/writes in a transaction and then rolls back
all data and audits. These repository commands use the realistic synthetic labels
and the apply command carries an explicit acknowledgement. The lower-level command
and `RUBI_ALLOW_LOCAL_MASTER_DEMO=1` remain supported for compatibility. Do not
substitute the general Prisma seed, which has a different scope. Keep the existing
encryption key unchanged.

## Verification

- API: 546 passed, 57 unrelated opt-in PostgreSQL tests skipped. This includes
  nine new fixture/target-guard tests and four new PostgreSQL 18 integration tests.
- Integration tests apply all 24 migrations to a new isolated database. They
  verify complete rollback on collision, preview rollback, two-run idempotency,
  preservation of existing/user-edited data, list/detail visibility, real FK
  links, masked contacts/audits and absent FX/external references. Only the exact
  generated isolated database is removed afterward; the operational DB is not
  reset or cleaned.
- API lint, typecheck and production build passed. No Web, schema, migration,
  contract, dependency/lockfile or Customers edits were needed.
- Local preview: 78 prospective creates, rolled back. Apply: 78 created.
  Repeat apply: zero created, 78 reused. All 78 local rows were independently
  recovered through the service's searchable list and detail responses across
  40 catalogs.
- API `http://localhost:4000/api/v1/health`: 200. Login
  `http://localhost:3100/login`: 200. Master Data without a session: 307 to Login,
  confirmed in the browser. Authenticated visual smoke is not claimed. API and
  Web were left running.
- The PostgreSQL adapter emitted its existing concurrent-query deprecation
  warning; tests and operational transactions completed successfully.

## Publication / ownership

Only this fixture unit and its tests/docs are published on its task branch.
The PR is stacked on `codex/pc-b-master-data-list-visibility` (#55), not directly
on develop. No parent branch, PC-A branch, main or develop is changed; no merge,
force push or source-branch deletion is part of this request. PC-B/MASTER-003
locks remain unchanged.
