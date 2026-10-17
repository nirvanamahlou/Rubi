# WORKBENCH-DAILY-PACKAGES-1015

COMPUTER_ID=PC-B. Branch: `codex/pc-b-workbench-daily-packages-1015` from `origin/develop`.

User requests a «پکیج‌های روز» tab immediately after Performance and an action above PNG export in Package Generator that publishes the final output there. Default audience is authenticated users in the selected permitted branch, with today selected and earlier days available.

Reserve Workbench daily-package API/Web, a new narrowly scoped Documents public service plus its module export, generator rendering/publish bridge and its React host, additive Workbench response contracts, the single new Workbench screen-catalog entry, focused tests, translations and bounded status entries. Generator presentation was previously assigned to PC-B and its earlier locks are released. Do not alter Sales pricing/domain logic. Documents retains storage, type validation, antivirus quarantine, audit and delivery policy. No direct Workbench access to Documents tables, migration, dependency/lockfile or permission grants.

Producer/consumer: authenticated Workbench endpoints call Documents' dedicated daily-package boundary; the generator host sends a generated artifact through Workbench. New responses and screen ID are additive; existing endpoints remain compatible. The parent/frame bridge requires the exact same origin and frame window and validates payload size/type. A final explicit publish action chooses an allowed branch; cross-branch and unrelated document IDs must fail closed.

Implemented:

- A Workbench tab immediately after Performance shows the selected Tehran day's packages, with permitted branch selection, historical date selection, stable pagination and an in-place PDF viewer/download.
- Package and Banner generator modes have a send action above PNG. They reuse the exact validated final multi-page PDF renderer, pass the Blob to the same-origin host, and publish after title/branch confirmation. Duplicate clicks are locked while rendering or saving. Offline standalone exports retain their normal behavior.
- Documents owns the branch/source-constrained archive query, normal upload validation, quarantine/scan and audited delivery. The optional final-download source constraint is additive and closes a metadata-change race between the dedicated check and final read. No other document receives the internal limited brand/file grants. Restricted/coded/step-up documents are excluded. The user confirmed the same-branch audience; manual per-screen IAM profiles retain their explicit screen grant policy.
- The new response types and screen entry are additive. Non-manual Workbench profiles inherit existing home visibility through the established `inheritFrom` mechanism. Shared English API and standalone generator catalogs are synchronized for the new labels/errors.

Verification: 26 API tests, 34 Web tests and one contract access test pass (61 total). Scoped API/Web ESLint, Contracts/API/Web typechecks, Contracts/Database/API/Web builds, changed-file formatting and JavaScript syntax checks pass. Prisma generation used a dummy connection string and did not connect to a database. No migration/dependency change, operational upload, authenticated browser delivery or live runtime deployment was performed. CI and PR review remain delivery gates; merge was not requested in this work item.
