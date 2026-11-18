# DETAIL-OWNER-FORMS-1117 — PC-D

## Scope and preservation

Eight predefined detail types: تنخواه، صندوق، حساب بانکی، دوره مالی، منبع تامین اعتبار، پروژه، مرکز هزینه، شعبه. New definitions default to seven classification digits and retain leading zeros. The editor shows the first unoccupied code in the selected ledger and type, starting at the configured first code or 0000000. Users can enter another available code. The server assigns automatic codes under the existing ledger lock and validates manual codes. The reference record’s business code is independent. The migration inserts only missing normalized titles; an existing definition's identity, activity, width and attributes remain untouched. Person/company and custom types retain their previous behavior. Existing contract numbers and personnel/agency/broker codes are not modified.

The separate finance reference audit remains in its own worktree. This unit is the owner's subsequent, explicit request for the eight detail title forms. It does not activate revenue/cost recognition or the earlier proposed numbering scheme.

## Sources and UI

The title picker searches and pages the selected source. The plus button opens its dedicated dialog; a row's pencil opens that record for editing. Save-and-select adopts the actual source ID/title. The detail code remains independent from the reference record's business code.

| Type | Source and form |
| --- | --- |
| شعبه | Per-ledger accounting branch definition: code, title, second-language title, enterprise shown read-only, main branch flag, active status and notes. It is an accounting definition, not a new authentication/security branch. At most one main accounting branch per book. |
| مرکز هزینه | Code, title, second-language title, required center type, active status, notes. |
| پروژه | Code, title, active status and notes. |
| منبع تامین اعتبار | Code, title, second-language title, required source type, source class and credit class, active status and notes. These classifications are manually entered; no official catalogue is invented. |
| دوره مالی | Existing fiscal-year definition; native structured notes. New creation does not allocate dates or change the company default: allocation stays in the ledger form. Deactivating the current default is rejected. |
| حساب بانکی | Existing company bank-account editor, encrypted identifiers, native permissions, bank branch/account-type requirements and CAS. A missing account type can be defined inline. Selection excludes external, inactive and unassigned-to-ledger accounts. A bank account linked to another book's detail cannot be reassigned to this book. |
| صندوق | Native CASH settlement account and TreasuryInstrument, cashier and cashier assignment history, currency, title/second-language title, physical location, descriptions and active status. Native edits are reflected and detected through CAS. |
| تنخواه | Per-book petty-cash definition with custodian, currency, deployment date, initial/operating initial amount, maximum amount, descriptions and notes. It does not create a fictitious bank/cash account or a spending advance. Initial amounts describe setup; posting a ledger balance requires the existing opening journal workflow. Petty-cash advance/top-up/expense operations remain separate. |

Rahkaran was read-only. Branch, project, cost-center, funding-source, cashbox and petty-cash forms were inspected. No save, delete, operational numbering or data import was executed there. Bank handling reuses Nora's existing secure company-bank form. The implementation does not claim a pixel-perfect clone or clone all of Rahkaran's petty-cash card and posting workflows.

## Invariants and storage

Existing AccountingConfiguration stores the scoped definitions; native fiscal years and bank/cash accounts are reused. AccountingDetail gains nullable sourceConfigurationId and sourceAccountId. The configuration link has a composite restrictive FK to (id,bookId); the account link has a restrictive FK. Legacy details remain NULL, without guessed backfill.

Server lookup validates actual book, active type, source kind and source activity. The source's title overrides forged client text. Existing inactive references may be retained but not newly assigned. Used journal detail references cannot be rebound. Existing accounting command permissions, per-book locking, replay/hash protection, audit and version checks apply. These definitions remain fiscal metadata and can be set up before a default year exists.

## Verification and rollout

A disposable PostgreSQL database is used on loopback port 55594; its integration suite refuses operational hosts/databases. It covers migration seed idempotency/preservation, native bank selection, zero padding, concurrent detail creation, source binding, reload and edit, replay/CAS, cross-book isolation, missing fields/permissions, main-branch uniqueness, inactive sources, restrictive deletion and native-cashbox edit detection.

Web tests cover the eight forms, required fields, read-only enterprise, native bank reuse and existing person/company detail routes. Existing accounting/bank tests are run for regression. Initial local results: 16 real-PostgreSQL integration tests, 17 Web tests and 165 existing accounting/bank regression tests passed (198 tests). API/Web/Contracts type checks, scoped lint, API/Web production builds, Prisma validation and offline translation-catalogue checks passed. The final migration was also applied to a second fresh disposable database; the new source links have no Prisma schema drift. No hosted CI was dispatched.

The seven-digit follow-up passed 17 PostgreSQL integration tests and 15 Web tests. The added regression verifies manual Persian digits, duplicate and overflow rejection, and automatic reuse of the first available gap.

Apply the additive migration before the matching API/Web release. No operational database migration or deployment was performed. Roll back application behavior by stopping new source definitions while retaining all new rows/links. Do not drop links, delete records, reseed party codes or renumber contracts.
