# SALES-CONTRACT-QR-PLACEHOLDER-0907

- COMPUTER_ID: PC-A
- Local branch: codex/pc-a-sales-customer-pricing-0907
- Base: 5e305c6
- User explicitly requested a currently non-working QR at the bottom right of contract output, before server deployment. This supersedes the earlier decision to omit the QR entirely, but does not authorize a public viewer or deployment.

## Implementation

- Shared print/PDF footer renders a black-on-white, sharp vector QR at the right, contact information at the left. Four-module quiet zone, 20 mm SVG, grouped footer with no page splitting. Existing notices, B Nazanin, amounts, section order, contacts and permissions are unchanged.
- It is an explicitly labelled presentation placeholder: مشاهده آنلاین پس از راه‌اندازی سرور. QR encodes only the fixed plain text `ONLINE CONTRACT VIEW - PENDING SERVER SETUP`, generated offline using the existing ReportLab QR encoder (version 3, L). The static matrix is checked in; no new runtime dependency or external QR service.
- No passenger, payment, contract ID, localhost, guessed public URL, bearer token or active verification claim is encoded. This QR is identical across contracts and cannot retrieve or verify any contract now. It does not expose data or alter authorization.
- The small contract-pending-qr helper is the future replacement point. Server deployment alone will NOT make existing printed/downloaded placeholders work. After a public CRM origin, secure per-contract/version sharing, access policy and expiry/revocation are implemented, replace the placeholder with authorized links and regenerate PDFs. Do not turn predictable contract IDs into public access credentials.

## Verification

- 166 Sales Web tests / 27 files, scoped ESLint and Web typecheck passed. Tests cover matrix shape/quiet zone, pending state, absence of active URLs, right-side footer order, preserved contact details and terms.
- Actual production renderer with embedded B Nazanin produced synthetic 2, 6, agency-6 and 42 passenger PDFs. Page counts: 1, 1, 1, 2. All five rendered PNG pages visually reviewed: QR at lower right, contacts left, no cropping, six-person layout retained, complete 42-person continuation.
- Ignored fixtures/output: tmp/qr-pdf-qa.ts and tmp/pdfs/qr-placeholder-0907. No real customer contracts/data were modified.
- Production build and local startup outcome recorded in central status after completion. Previous Web output retained in tmp/qr-placeholder-web-before-0907 for recovery.
- No API, schema, dependency/lockfile, IAM, seed, producer worktree, deployment or public push. Known-public remote is not used for private CRM publication.
