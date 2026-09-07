# SALES-CUSTOMER-PRICING-0907

- COMPUTER_ID: PC-A
- Branch: codex/pc-a-sales-customer-pricing-0907 from 206635c.
- Initial scope: Sales Web people-sheet and print. The clarified follow-up expands this to additive Sales passenger prices, public contracts/API persistence, and a Web PDF download route. No IAM grant, producer edits or public push.

## Delivered slices

Print table headings, metadata cards and accents now use dark blue #173d7a alongside the existing navy sections. B Nazanin and actual saved agreement/Finance amounts remain unchanged. Synthetic PDFs with a logo were rendered and all pages inspected: one page for two passengers/two currencies, three pages for 42 passengers.

Selecting an existing person requests authorized customer-verification detail and fills the table, including revealed identity/passport/contact fields when permitted. A forbidden sensitive read falls back to masked detail; no grant or security bypass. Focus returns to the selected editable row. First-passenger linking continues to synchronize the same person rather than creating another customer.

Name, surname, national ID, birth date, passport number/expiry and phone/email can be edited for an existing loaded person. The save action uses the existing Customers update API and latest optimistic version, preserves roles/acquaintance method, omits unchanged masked identifiers, and propagates permission/version errors without discarding entered values. Sensitive row values and comparison baselines remain in component memory, not persisted Sales drafts.

Phone/email corrections use the existing audited addContact action with isPrimary=true, which demotes only prior contacts of that same type. Contact history is retained; deleting/clearing contact values is not supported here. Successful writes update the draft version/baseline immediately. An uncertain contact result requires reselecting/reviewing the record rather than blindly adding it again.

This person-row change does not add organization/agency master-data editing.

## Clarified and delivered package pricing

The user clarified individual totals for ALL services per passenger, not age-category ticket rates. The price stage now opens a monetary entry per current passenger/currency. Exact BigInt/Decimal reconciliation requires the entered sum to equal the existing service-agreed contract total. Explicit zero is supported for free passengers. No division, age percentage, exchange conversion or purchase-price mutation is inferred. Stored individual prices appear in the saved contract output; legacy rows explicitly say unrecorded. Updates cannot silently drop recorded passenger prices.

## Direct PDF and final verification

- A separate Download PDF action beside Print calls the dynamic Web route `/sales/contracts/[id]/pdf`. The route reads the existing authorized Sales output API (sales.export, contract ownership/branch scope, legal-entity context), uses public Master Data, and renders only server-generated escaped HTML. It does not accept client HTML, URLs or prices. Response is a private/no-store PDF attachment. Official issuance/archive and receipt disclaimers remain.
- Runtime requires absolute `SALES_PDF_CHROME_PATH` and `SALES_PDF_NAZANIN_PATH`; local Web was launched with the installed Chrome and B Nazanin font. No new dependency or font binary was committed. Isolated headless profiles, constrained environment, disabled external resolution, CSP, two-job limit, 30-second process timeout and temporary-directory cleanup bound rendering. Missing runtime returns a safe 503; there is no fake download fallback to printing.
- Money uses ASCII grouping/decimal separators and Arial numeric glyphs; Persian prose uses embedded B Nazanin. Actual renderer QA produced one page for two passengers/two currencies and three pages for 42; all pages visually inspected. QA files contain synthetic identities and are ignored, not customer deliverables.
- 129 Web Sales, 44 API Sales and 47 Contracts tests passed. Route tests cover permission rejection, invalid IDs, saved-source bytes/attachment headers and safe renderer failure. Scoped lint, Contracts/Database/API/Web typechecks and API/Web production builds passed (36 static pages plus the dynamic PDF route).
- All migrations passed on fresh `rubi_passenger_8080c25a9120459892f90fc2e8579b5d`; seed twice retained 86 permissions. No operational seed was run. PostgreSQL exact decimal roundtrip, unique currency, nonnegative check and passenger FK passed on the restored copy; all fixture writes were rolled back.
- Backup restore rehearsal `rubi_passenger_restore_c201c67541894ed1997417b38db81a5b` passed. Operational activation applied only `20260907103000_sales_passenger_package_prices`, preserving every stored historical checksum and checked business count. Pre-existing historical file differences were not rewritten; decision is in DECISIONS.md.
- Retained ignored operational backup: `tmp/before-passenger-prices-1788768458270.dump`; previous Web build: `tmp/passenger-pdf-web-before-0907`. Web3100/API4000 restarted. Login/health 200, protected Sales 307, invalid-session direct PDF 401. No authenticated real-contract walkthrough is claimed.
- Complete locally; scoped Migration/Sales contract/docs locks released. Remote publication remains unapproved because the configured repository is public.

## Earlier customer-edit slice verification

- 236 Sales/Customers/navigation Web tests passed, including authorized-detail mapping, keeping dirty edits while refreshing, mask omission, versioned identity/contact writes, unchanged resubmission and invalid-ID/conflict rejection.
- Fourteen final people-model tests rerun after checking the public API's per-contact-type primary behavior.
- Scoped lint and Web typecheck passed.
- Synthetic interactive Chromium: select existing customer, read authorized values, focus editable row, edit name, sync passenger one, save correct customer version and avoid duplicate creation.
- No authenticated real-customer walkthrough or operational mutation is claimed.
- Production Web build passed (36 routes), and final-CSS interactive customer editing passed again. Web3100 restarted; login/API health 200, protected new-contract form 307. API4000 unchanged. Prior Web retained at tmp/customer-edit-web-before-0907.
