# SALES-CONTRACT-REFERENCE-THEME-0907

- PC-A; local branch codex/pc-a-sales-customer-pricing-0907; base e312159.
- User requested the supplied reference image's theme only, preserving current contract fields, logic and section positions, plus a footer QR.

## Delivered locally

- Shared print/PDF CSS uses a navy header and number badges, teal separator, pale gray-blue metadata/table headers, fine square borders and outlined signature areas.
- HTML fields and order remain unchanged. No reference-image phone/email fields were copied. Existing company branding, B Nazanin, English monetary digits, passenger totals, agency-only commission, finance-confirmed balances, hotel details, notices and Nystkt.ir remain.
- Compact spacing preserves six-person single-page output, repeated passenger headings and natural multi-page continuation. No passenger truncation or business-logic changes.

## QR clarification and deferred work

- User selected a verification page for this specific contract, then clarified that online contract viewing, similar to Google Drive viewing, is wanted after moving the CRM to a server.
- Current runtime is localhost:3100 and no public CRM origin was supplied. The existing website address is not treated as a contract verification service.
- No QR is embedded yet: neither a localhost link, an unrelated website link, nor fabricated verification. No public endpoints or deployment were added.
- Server-phase follow-up: agree the public origin and access policy, implement scoped contract/file viewing links, bind verification to the saved contract version, and define revocation/expiry before enabling QR generation. Do not put passenger identity, passport or payment details directly in the QR; do not expose contracts through predictable public IDs.

## Verification and handoff

- 159 Sales Web tests passed; final 17 print tests and scoped ESLint passed after strengthening the section-presence assertion. Web typecheck and 36-route production build passed.
- Actual production PDF renderer with embedded B Nazanin generated synthetic 2-person, 6-person, 6-person agency and 42-person contracts. Page counts: 1, 1, 1, 2. All five final pages visually reviewed; no clipping or omitted continuation.
- Ignored QA outputs: tmp/pdfs/reference-theme-0907. No real customer data was created or edited.
- Web3100 rebuilt/restarted; login and API health both return 200. API was not changed or restarted. Prior Web build retained in tmp/contract-theme-web-before-0907 for local recovery.
- No schema/migration, dependency manifest, permission, producer-worktree or public remote changes. Local commit only because the configured remote is known public. Scoped reservations released; online viewer/QR remains explicitly deferred.
