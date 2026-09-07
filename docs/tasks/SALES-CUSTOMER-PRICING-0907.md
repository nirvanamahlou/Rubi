# SALES-CUSTOMER-PRICING-0907

- COMPUTER_ID: PC-A
- Branch: codex/pc-a-sales-customer-pricing-0907 from 206635c.
- Scope: Sales Web people-sheet model/component/tests, print template/tests and task docs. Existing Customers public entry/API only. No database migration, API change, IAM grant, producer edits, public push or real customer data mutation.

## Delivered slices

Print table headings, metadata cards and accents now use dark blue #173d7a alongside the existing navy sections. B Nazanin and actual saved agreement/Finance amounts remain unchanged. Synthetic PDFs with a logo were rendered and all pages inspected: one page for two passengers/two currencies, three pages for 42 passengers.

Selecting an existing person requests authorized customer-verification detail and fills the table, including revealed identity/passport/contact fields when permitted. A forbidden sensitive read falls back to masked detail; no grant or security bypass. Focus returns to the selected editable row. First-passenger linking continues to synchronize the same person rather than creating another customer.

Name, surname, national ID, birth date, passport number/expiry and phone/email can be edited for an existing loaded person. The save action uses the existing Customers update API and latest optimistic version, preserves roles/acquaintance method, omits unchanged masked identifiers, and propagates permission/version errors without discarding entered values. Sensitive row values and comparison baselines remain in component memory, not persisted Sales drafts.

Phone/email corrections use the existing audited addContact action with isPrimary=true, which demotes only prior contacts of that same type. Contact history is retained; deleting/clearing contact values is not supported here. Successful writes update the draft version/baseline immediately. An uncertain contact result requires reselecting/reviewing the record rather than blindly adding it again.

This person-row change does not add organization/agency master-data editing.

## Pending pricing decision

Current contract service prices are totals for all assigned passengers/rooms. There is no authoritative persisted individual sale allocation to print. Asked whether to enter day/agreed ticket prices per age category (recommended: adult/child/infant, without automatic assumed discounts) or per individual passenger. That price-entry/persistence/validation/output slice remains unimplemented; neither equal division nor age percentages were fabricated. Existing output still refers to the aggregate contract amount.

## Verification

- 236 Sales/Customers/navigation Web tests passed, including authorized-detail mapping, keeping dirty edits while refreshing, mask omission, versioned identity/contact writes, unchanged resubmission and invalid-ID/conflict rejection.
- Fourteen final people-model tests rerun after checking the public API's per-contact-type primary behavior.
- Scoped lint and Web typecheck passed.
- Synthetic interactive Chromium: select existing customer, read authorized values, focus editable row, edit name, sync passenger one, save correct customer version and avoid duplicate creation.
- No authenticated real-customer walkthrough or operational mutation is claimed.
- Production Web build passed (36 routes), and final-CSS interactive customer editing passed again. Web3100 restarted; login/API health 200, protected new-contract form 307. API4000 unchanged. Prior Web retained at tmp/customer-edit-web-before-0907.
