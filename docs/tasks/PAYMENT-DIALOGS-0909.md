# PAYMENT-DIALOGS-0909

PC-A. Base: 2a747c5, reservation-reference-form stack. Only Sales contract payment UI/tests changed.

- Open per-contract history in a bounded, RTL, scrollable shared Radix dialog.
- Separate Add dialog with existing amount, currency, due date, method/check and tracking inputs.
- Successful save keeps fields visible and disabled; existing public PaymentDocuments uploader appears immediately below tracking. A second payment cannot be submitted in this state. Closing returns to updated history.
- Existing payments expand their own receipts, preserving source payment and branch association.
- Existing version/idempotency, finance states and Documents permission/scanning checks remain intact.

Validation: 10 targeted tests, scoped ESLint, Web TypeScript and production build passed. Ignored tmp/payment-dialogs/check.cjs exercises actual React dialogs in headless Edge against synthetic adapters: old history, add, one create, upload associated with new ID, return retaining both rows. No operational payment created. This is not an authenticated real-upload test.

No migration, backend change, IAM grant or shared Documents module edit. Web3100 refreshed; PDF environment preserved. Draft review is stacked on the reference-form branch; no merge.
