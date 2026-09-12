# B2B-ALL-AGENCIES-DEMO-001 — PC-B

The owner requests example dossier records, including contracts, for every existing agency. The local database contains seven agencies (all active). All were covered, including the multi-role organization, Misterbilit and Alibaba.

## Execution

- Database: `rubi_hr_current_20260908`; unchanged Web3100/API4191 and Documents storage.
- Backup: `C:/Users/admin/Rubi-backups/b2b-contract-credit-demo/before-1789141836258.dump`, SHA256 `752b7798bfe640c1f9467db9b907db46e58f63f9598e4f10fe385cc20008a236`.
- Existing local-only fixture scripts accept explicit `B2B_DEMO_ALL_EXISTING=1`. Default four-agency scope is retained. Shared discovery paginates, filters agency roles and rejects ambiguous names. Contract titles and new account usernames use stable organization identifiers. Existing operator permissions are checked; writes use public owner services and retain audit history.
- Added 14 DRAFT agreements (two per agency), containing 28 guarantee terms and 28 independent IRR/USD credit policies. Six new proof files were uploaded; existing proofs reused. No activation, approval, bank confirmation or real financial balance was created.
- Added seven inactive sample signatories, six addresses, eight representatives, nine rates/discounts/commissions, two missing cooperation profiles, and 21 organization-scoped accounts. Credentials remain in a private directory outside Git. No existing user grants changed or global roles granted.
- Every agency has sample data in its dossier; existing Finance scenarios remain explicitly labelled UI previews, not ledger writes.

## Verification

- Repeat dossier/users previews request zero changes; guarantee verification reloads all seven contracts with three guarantees and two proof links each.
- Public activity service reloads all seven dossiers, with B2B/Master Data/Documents events in every dossier: 28, 23, 18, 23, 62, 25 and 19 total historical events respectively. These counts include pre-existing history.
- Selector regression test covers pagination, mixed roles, default scope and ambiguous names. Script lint, API typecheck and build executed. No migration, application source change, runtime replacement or merge required.
