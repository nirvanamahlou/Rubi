# SALES-OUTPUT-LAYOUT-0907

- COMPUTER_ID: PC-A
- Branch: codex/pc-a-sales-output-layout-0907
- Base: c63318a, verified local integration.
- Local-only delivery. Fetch succeeded; newly fetched PC-B customer-document-upload and HR changes are outside scope and were not merged. Existing remote remains public, so no push.

## Changes

The new-contract path lacked a navigation alias, producing the misleading unavailable breadcrumb. Add its Sales parent and Persian title. Constrain the form grid to minmax(0,1fr) and its card to min-width zero so the shared wide passenger table scrolls internally instead of expanding the page.

Add a saved-contract output button after confirmation and beside dashboard contracts. GET /sales/contracts/:id/output returns SalesContractOutputV1 JSON using the existing authenticated Sales read scope plus sales.export and legal-entity.read. Draft/pending contracts cannot produce a final copy; aggregate company context is rejected. Customer and Legal Entity information comes through public services; owner display name is read through IAM only when the actor already has iam.users.read. No direct cross-module table queries.

The existing Sales audit table records sales.contract.output_preview with contract version, generated time, company branding snapshot and payload fingerprint; it does not claim that printing or official issuance completed. The API uses private/no-store. No new schema, migration, operational seed, IAM grant or dependency.

## Print semantics and limits

- The preview uses six sections corresponding to the supplied travel-services-contract-redesign.pdf: parties, passengers/pricing, flights, hotel, other services, signatures. Missing fields show an unavailable marker, not fabricated values.
- Browser Print / Save as PDF is the explicit download workflow. This is not a server-side binary PDF endpoint, permanent document archive or automatic customer delivery.
- Local B Nazanin is required and checked before printing. Browser PDF output embeds the available font; no font binary is redistributed in Git.
- Agreed saved contract balances are the sale amounts, not quoted ticket/day prices or supplier costs. Only confirmed Finance payments reduce the displayed balance.
- Per-passenger price allocation is not recorded, so passenger rows refer to the contract total rather than repeating/dividing it. Agency-only commission is shown as unrecorded and never deducted. User clarification and a persistent commission model remain separate work.
- Current contract data has no saved issuer link. This informational copy explicitly identifies the active company at output time; it is not official archived issuance, tax invoicing, payment receipt or final reservation confirmation. The Legal Entity fail-closed official issuance policy is untouched. Historical issuer binding/template approval/archive integration remain a separate prerequisite for official issuance.
- Customer address/reference descriptions are current public master data, not a historical snapshot. No real record is modified to build the copy. Cancelled contracts carry a prominent cancellation notice.
- HTML escapes dynamic data, accepts only inline PNG/JPEG logos and uses a script-free sandboxed iframe/CSP. Content and temporary failures are not persisted in Sales draft storage.

## Verification and rollout

- Scoped Sales Web/API and navigation lint passed. Contracts/API/Web typechecks passed. One partial test fixture required an explicit unknown cast; the final typecheck and output tests were rerun successfully.
- 233 Web Sales/Customers/navigation tests, 44 Sales API tests, 41 public Contracts tests passed; the five final output authorization tests were rerun after the test-only correction.
- API production build and Web production build (36 routes) passed.
- Synthetic Chromium with real components and final CSS: saved-data preview, sandboxed-iframe B Nazanin loading, print action, desktop and mobile form containment all passed. No authenticated end-to-end real-contract test or user record creation is claimed.
- PDF QA used synthetic non-personal data: ordinary two-passenger/two-currency output fits one A4 page; 42 passengers span three pages with repeating table headers and independent rows. All rendered pages visually inspected. QA scripts, PDFs and screenshots remain ignored under tmp/.
- Web3100 and API4000 restarted using existing environment/key values. Login, current JS bundle and API health returned 200; protected Sales pages returned 307; unauthenticated output returned 401; CORS preflight returned 204 for localhost:3100.
- Previous Web build retained at tmp/sales-output-web-before-0907. No data migration or destructive cleanup; task reservations released after local delivery.
