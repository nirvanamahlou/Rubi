# B2B-DOSSIER-FORMS-001 — PC-B

## Delivered behavior

The agency 360 overview shows stored dossier counts and shortcuts to its forms. Branch/address, operational profile/account manager, fixed rates, discounts and commissions have popup entry/edit forms. Address and rate records support version-checked permanent deletion; rate deletion requires a reason. Existing representative, organization/logo, Documents and versioned agreement/credit/guarantee forms remain the owner integrations.

The B2B profile read projection contains only profile fields and active same-branch manager names/IDs from the public IAM service. It does not disclose nested agreements, credit policies, user emails or IAM roles under agency-read permission. Rate reads/writes/deletes retain role, organization and branch scope. Updates and deletes use expected versions, and audits commit atomically. Overlapping active rates are serialized per profile. Inactive rates may be drafted under review; active rates still require an active profile. Separate currency ceilings and independent agreement/credit approval remain unchanged.

## Local synthetic data

`apps/api/scripts/b2b-dossier-demo.mjs` accepts `--preview` or `--apply`, a confirmed `rubi_hr_current_YYYYMMDD` database, an existing active synthetic fixture actor UUID, and its branch UUID. It refuses production or any database host/port outside localhost:55432. It uses public Master Data, IAM and B2B services; it creates no IAM user/session/grant and invokes no approval. No Documents content or financial projection is fabricated. Every existing matching fixture is reused without overwrite. All preflight reads complete before the first write; individual owner-service writes are transactional and reruns resume after a partial failure.

Applied to the existing four explicitly named synthetic agencies: افق سفر، آبیراه، آسمان، نیلگون. Added 4 under-review profiles, 8 addresses, 8 synthetic representatives with example.test emails, 12 inactive rate/discount/commission records, and 4 draft agreements containing 8 currency policies and 4 deposit requirements. No agreement is submitted/approved and no guarantee is marked received. A subsequent preview reports zero pending writes. Backup before applying: `C:/Users/admin/Rubi-backups/b2b-dossier-forms/before-fixtures-1788910797234.dump` (739363 bytes, SHA256 `64c1c2543cde9ac4e0409c03d593d0fddc9a2f788694f3550bc58bd2a1d49e2a`).

## Validation and limitations

- API: 176 targeted tests; separate disposable PostgreSQL 18 run passes 14 tests, including rate overlap/concurrency, edit/delete scope, stale versions and transactional audit failure rollback for both rates and addresses.
- Web: 89 Organizations/navigation tests; browser with actual React components and isolated public-port fixtures verifies overview navigation, address create/edit/delete, exact decimal rate create/edit/delete and manager reassignment. Popup styling uses Rubi controls and font. This is separate from authenticated production-session validation.
- Contracts: 61 tests and package build. API/Web lint, typecheck and production builds pass (40 Web routes). All four push CI gates pass on aa964d6. Final browser popup styling has no console errors.
- No migration or dependency change. Existing Finance/Sales/access placeholders remain owner integration work and are not represented as completed financial or reservation operations.
- Existing live IAM roles have no B2B grants. No grants are added implicitly: an authorized writer/reviewer account must be selected by the owner before authenticated B2B forms become available to that account. Master Data forms retain their existing permissions. Contract approval cannot be performed by the proposer/editor.

## Handoff

Branch `codex/pc-b-b2b-dossier-forms` starts from 7518154 and retains PR132 (contract/credit) and PR133 (breadcrumb), including develop e07c0c6. Review/merge dependency order is PR132, PR133, then this task. Do not overwrite the unrelated main checkout or change the runtime database/Documents storage. Source reservations and local runtime ownership are recorded in WORK_ASSIGNMENTS; no merge is performed by this task.

Source aa964d62b82e63b961da529fcc4ede1ac68b133a is running on Web3100 PID15740, version hr005-96235a5b777bc891, with API4190 PID14320 healthy and the `/api/v1` public base preserved. Draft PR134: https://github.com/nirvanamahlou/Rubi/pull/134. Live counts are 12 organizations, 10 contacts, 8 addresses, 4 profiles, 12 rates, 4 agreements and 8 currency policies. IAM remains 5 users, 9 roles and 177 role-permission grants. Private runtime verification is saved beside the fixture backup. The owner was asked specifically whether to add B2B read/manage access to Nirvana, without independent approval privileges; no answer or grant yet.
