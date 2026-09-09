# B2B-CONTRACT-CREDIT-DEMO-001 — PC-B

The owner requests credit/guarantees beneath contracts in the 360 dossier and synthetic guarantee/finance data.

## Changes

- The 360 home now has five section cards. Credit/guarantees lives under Contracts and Commercial Terms, with policy, guarantees, exposure and temporary-increase subnavigation. Breadcrumbs include the contracts parent and return to its framework tab. Existing B2B credit permissions, independent approval and section grant identifiers remain unchanged.
- Temporary increase opens the existing contract revision workflow with an explanation that a dated revision and independent approval are required. Actual exposure remains unavailable until the Finance owner adapter is implemented; no preview balance is fed into credit calculations.
- Six finance tabs show an explicitly labelled synthetic scenario: statement, three invoices, three receipts, two checks, two settlement summaries and two disputes. Currency/date/status filters and detail dialogs work. IRR and USD totals reconcile independently using integer arithmetic; pending checks, guarantees and unresolved disputes are not counted as receipts. The scenario is a UI preview, not persisted Finance data or a record of the selected agency's actual transactions. FINANCE-001 Phase B persistence remains absent; no Finance producer/table changes were made.
- `apps/api/scripts/b2b-guarantees-demo.mjs` uses only public IAM reference, Master Data, Documents and B2B services. It accepts an existing local operator, derives existing permissions, preflights four explicitly synthetic agencies and creates missing draft contracts/proofs only. No account/grant, approval, active credit or bank confirmation is created. Repeated runs preserve user edits and reuse fixtures.

## Local data and verification

- Database `rubi_hr_current_20260908`, existing Documents storage retained. Backup before writes: `C:/Users/admin/Rubi-backups/b2b-contract-credit-demo/before-1788982071474.dump`, SHA256 `8efb767f9b68b30096f554f070e3f35186f6bfd6243a4a84bd5c2b8b35422fee`.
- Four DRAFT contracts across آژانس آزمایشی افق سفر، آبیراه، آسمان، نیلگون contain 12 guarantees (bank, cheque and deposit requirement), eight attached Documents proofs and eight per-currency credit policies. A second apply creates/uploads zero records and reuses all four contracts. No schema or migration.
- 92 Organizations tests pass, including currency reconciliation and inclusive/reversed date range coverage. Web lint and typecheck pass. Browser checks using actual React components verify five home cards, nested contract/credit navigation, guarantee contents, and labelled financial rows. Selecting 1405/6/14 as the start date filters six statement rows to three; USD reduces them to one, whose detail dialog references the matching sample invoice.
- The local fixture browser uses isolated API fixtures; actual stored guarantees were separately reloaded by the public B2B owner. No staff login was bypassed.
- Source build, runtime and remote checks will be recorded at completion. Branch `codex/pc-b-b2b-contract-credit-demo` retains the PR145 stack from49d578e. No merge.
