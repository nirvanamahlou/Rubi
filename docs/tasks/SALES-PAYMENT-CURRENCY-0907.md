# SALES-PAYMENT-CURRENCY-0907

- PC-A; local branch codex/pc-a-sales-customer-pricing-0907; base 106ca1b.
- User identifies the remaining free-text currency in the Sales dashboard's saved-contract payments panel.

## Change

- Replaced that textbox with a required, button-only Rubi-themed dropdown. The label shows registered currency name and ISO code. It does not accept arbitrary typed values.
- All active currency pages come from the public Master Data API. Missing lists do not synthesize IRR or another code. Inactive/malformed/duplicate codes are handled by existing Sales currency-option helpers.
- Loading/error/empty states prevent payment submission and provide retry. The selected code is validated against the loaded active list before the existing versioned/idempotent payment call. Successful submission resets to a registered default.
- Existing new-contract pricing/payment currency editors already select registered currencies; no unrelated changes to those editors, backend monetary rules, Finance confirmation, IAM, stored payments or other modules.

## Verification

- 158 Sales Web tests pass, including active-reference pagination/failure/empty-list and non-editable selector tests. Scoped ESLint and Web TypeScript pass.
- Synthetic browser test of the actual ContractPayments component checks initial lookup failure disables submit, retry loads the active list, control is a BUTTON rather than an INPUT, inactive entries are absent, USD can be chosen, and the selection survives closing the dropdown. No real payment was created.
- Production Web build and local startup are recorded in central task status. Prior Web retained under tmp/payment-currency-web-before-0907; synthetic QA remains ignored under apps/web/tmp/payment-currency-*.
- No migration, dependency/API change, grant, real-customer mutation or API restart. No public push; local commit only.
