# SALES-PAYMENT-EVIDENCE-0907

- COMPUTER_ID: PC-A
- Status: COMPLETE_LOCAL
- Branch: codex/pc-a-sales-customer-pricing-0907
- Base: 54774eb

## Delivered

- Optional payment tracking number in new-contract payment plans and existing-contract payment entry. Uses existing paymentReference public field/database column; maximum 160 characters, control characters rejected. No migration.
- Dashboard contract search includes stored payment references only when the actor has sales.payments.read, preserving existing contract ownership and branch scope for both list and count. No additional payment details exposed in contract summary. Within a contract, tracking search filters payment rows and shows scheduled, pending, confirmed or rejected Finance status distinctly. Search input is bounded to 160 characters. This is stored-record search, not bank verification.
- Each persisted payment has a collapsible Documents panel. Upload is available after saving the payment (and, for new contracts, after saving the contract). PDF/JPEG/PNG receipts are validated against registered MIME/size policy and submitted through the existing public Documents API. No file is kept in form persistence or local storage.
- Canonical source is sales / SalesContractPaymentEntry / saved payment ID, with the contract branch. The Sales UI model verifies membership in the loaded contract. Existing Documents generic source-reference handling remains unchanged; it is not a new server-side Sales ownership validator or proof that a transfer occurred.
- Registered RECEIPT / FINANCE type and PROCUREMENT_FINANCE category, current actor owner, RESTRICTED confidentiality. Existing Documents permission, branch, domain, encryption, quarantine, scan, sensitive-read and download gates are unchanged. Missing permissions/configuration are surfaced, not bypassed. Scan success is explicitly separate from Finance confirmation.
- List pagination, status and gated download use public Documents APIs. Network/unknown upload outcomes do not auto-retry; users inspect the refreshed list before explicitly selecting a file again. A successful upload followed by a failed list refresh remains acknowledged as saved.
- Upload and tracking search never reduce the balance or mutate Finance status. No receipt sent to a customer or external bank.

## Verification

- Web: 164 Sales tests / 26 files passed; scoped ESLint and typecheck passed; production build completed all 36 routes.
- API: 62 Sales plus Documents permission/storage/validation tests / 8 files passed; scoped ESLint, typecheck and production build passed.
- Synthetic browser harness uses actual payment components and production CSS with stubbed data. Verified tracking filter, distinct rejected status, exact payment attachment source/branch, restricted form, persisted list, download, unchanged pending Finance state and uncertain-upload retry guard. Screenshot visually inspected. No real receipt or customer/payment record was created.
- Local Web3100 and API4000 restarted with existing configuration/key; login/health return 200. Unauthenticated Sales and Documents endpoints return 401.
- Authenticated real-account upload and live antivirus processing were not exercised. Files remain non-downloadable until existing scanner reports CLEAN and permission allows download.
- No schema, dependencies, IAM grants, seed, producer-module edits or public push. Existing remote is known public, so commit remains local. Previous Web build retained under ignored tmp/payment-evidence-web-before-0907 for recovery.

## Usage

Enter the tracking number while adding a payment. After saving, open that row's مدارک پرداخت and upload its receipt. Later search the number in the Sales dashboard, open پرداخت‌ها و اقساط, and filter payment rows to inspect the stored Finance status and attachments.
