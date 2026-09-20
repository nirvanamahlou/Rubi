# SALES-INSURANCE-SELECTION-0908

- Computer: PC-A. Branch: codex/pc-a-sales-customer-pricing-0907; base 3b82a72.
- User scope: choose an existing insurance plan in new Sales contracts, without free-text description. User explicitly deferred insurer API connection/issuance to Reservations later.
- Sales reads only the public Master Data `insurance-plans` API, across active pages. The existing themed dropdown selects a registered plan; loading, failure/retry, empty lists and inactive saved selections block continuation.
- The existing Sales service stores the plan reference, display title, plan record version, insurer reference/name and `insuranceSelectionVersion: 1` scalar metadata. Legacy insurance notes are not copied into the new selection. All selected passengers retain the insurance service assignment. Existing version-1 reservation requests copy service selections/metadata and passenger assignments without a new database model.
- State is `NEEDS_RESERVATION_CONFIRMATION`: this is a commercial selection, not an issued policy, eligibility check or insurer approval. Future Reservations/Integrations work must verify plan/provider mapping, destination, dates, ages, coverage and current availability, implement idempotent issuance and provide real output using authorized passenger details. No fake policy/adapter was added.
- This UI validates against the active catalog loaded for selection. It does not introduce a server-side issuance/eligibility validator; no such guarantee is claimed.
- No API/schema/migration/dependency/IAM/producer changes, real record mutations or public push. Private CRM remains local because the configured remote is public.

## Verification

- 185 Sales Web tests pass, including active paginated selection, failed/partial/empty lists, invalid records, missing selection, JSON draft restoration, reference/metadata/passenger assignment and absence of legacy notes or policy numbers.
- Scoped ESLint and Web typecheck pass (the explicit optional-prop typing found during QA was corrected).
- Actual-component synthetic Chromium checks pass: error/retry/empty, button-only themed selection, inactive filtering, no description field, continuation gating, pending snapshot and mobile width. Dropdown screenshot inspected; no real insurance/customer requests or mutations.
- 36-route Web production build passed; updated Web3100 and API4000 health both return HTTP 200. Previous Web build retained in ignored tmp/insurance-selection-web-before-0908. Tests use synthetic records; authenticated live issuance was deliberately not attempted.

## Handoff

Later insurer integration belongs in Reservations/Integrations, using the saved plan reference and authorized passenger data through public contracts. Credentials must be configured securely, not committed or entered into contract metadata. No insurer request is sent by this task.
