# SALES-PAYMENT-SEARCH-UPLOAD-0908

- COMPUTER_ID: PC-A. Base: 54c4e6a. Branch: codex/pc-a-sales-customer-pricing-0907.
- User correction: tracking search must find any authorized contract, not just payment rows of the open contract; provide a visible place to upload payment proof.

## Delivered

- Replaced the local payment-reference filter with an all-contract search form. It submits to the existing main Sales workspace/server list search, resets page and old settlement filters, closes the old payment panel and scrolls to contract results. A reference belonging to another contract is no longer hidden by local row filtering.
- Existing backend matches stored payment references under sales.payments.read and contract owner/assigned-user/branch scope. List and count use the same scoped predicate; no permissions were widened and no bank verification is implied.
- Added a prominent "آپلود رسید و مدارک پرداخت قرارداد" section with a themed saved-payment selector. File input, upload, existing receipt list and download are directly visible without an extra expand click. Each payment row links to this section. Newly saved payments are selected automatically when their persisted ID is returned.
- Receipts remain linked to the selected persisted payment through public Documents APIs; no unsaved/guessed payment ID, direct module query, automatic uncertain-upload retry or Finance-status mutation. PDF/JPEG/PNG validation, restricted confidentiality, scan, branch and download permission gates are preserved. With no saved payment the section clearly instructs the user to save one first.
- No API/schema/migration/dependency/IAM changes, real business records or uploads. Private CRM is not pushed to the public remote.

## Verification

- 188 Web Sales tests pass, including server-backed all-contract reference query, no stale contract/settlement restriction, visible receipt area and file input.
- Existing 5 backend reference-search tests pass (payment permission, contract ownership/branch scope, identical count/list criteria and bounded reference validation).
- Scoped lint and Web typecheck pass. An ignored older browser harness was updated for the newly required search callback.
- Synthetic actual-component Chromium QA passes: global-search callback for another contract, current payments not locally filtered, upload visible without expansion, exact saved-payment/restricted binding, persisted receipt list/download, unchanged Finance status and uncertain-outcome guard. Full-page screenshot inspected; no real records used.
- 36-route Web production build passed. Updated Web3100 login and API4000 /api/v1/health return HTTP 200. Previous build retained in ignored tmp/payment-search-upload-web-before-0908. Authenticated real-account receipt uploads and live antivirus were not exercised; existing security gates remain authoritative.
