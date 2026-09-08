# RESERVATIONS-TICKET-ACCESS-0907

- Computer: PC-A. Branch: codex/pc-a-sales-customer-pricing-0907.
- Base: e0159f8. Local integration worktree only. User asks to retrieve tickets again from a contract in Reservations whenever needed.
- Scope: Reservations inbox/list query/tests and Sales public presentation boundary; no new persistence, migration, permission grant or external issuance.

## Delivered

- Flight-containing request cards expose «بلیت‌های مسافران · مشاهده و چاپ».
- The dialog reads the persisted versioned Sales reservation snapshot, not unsaved form state or current ticket inventory. Reopening a contract repeats that saved content.
- Each passenger sees only the flight service keys assigned to them, ordered outbound then return. Infant assignment is preserved; hotel-only passengers receive no invented flight. Business labels and free directional transfers use saved service metadata.
- One passenger or all ticket-bearing passengers can be printed; every passenger starts a separate A4 page. PDF is explicitly browser Print → Save as PDF, not a new direct-download endpoint. Close removes the print portal and personal preview from the DOM.
- City names are optional public Master Data references. Missing names produce a warning and a dash. Missing historical flight/assignment snapshots produce an explicit unavailable state, never guessed inventory or passenger bindings.
- List requests accept optional page (100 entries/page) and contractNumber search against the saved snapshot. Both retain reservations.read, authenticated actor branch IDs, private/no-store and deterministic date/id ordering. Invalid pages/non-text or oversized searches are rejected. A full final page may lead to one empty next page; no expensive total-count query was added.
- Public Sales browser entry exports only the document presentation/data interface; Reservations does not import its form internals or query Sales tables.

## Safety and limits

- This is a repeatable saved preview, not an airline-issued ticket. Existing DRAFT and sample-only TEST AIRLINE 7143/DEMO01 notices remain prominent. No real PNR/e-ticket/status is invented, and no passenger data or issuance record is mutated.
- No automatic customer sending. No additional passport, financial, payment or customer fields exposed.
- Existing snapshot/company branding limitations of the prior ticket template remain unchanged. Archived requests without sufficient snapshots require producer data repair; no silent backfill.
- Repository origin is public. No private CRM changes are pushed; no merge, rebase, force push, migration, dependency or producer-worktree edit.

## Verification

- 162 Sales/Reservations Web tests pass; Web typecheck, scoped ESLint and 36-route production build pass.
- 15 Reservations API tests pass; five existing hotel-purchase database integration tests skip without their dedicated test database. API typecheck, scoped ESLint and production build pass.
- Local PostgreSQL read-only query with an empty authorized branch list checks real JSON search/pagination execution and returns zero rows; no business data read or write required.
- Synthetic browser test using the actual dialog, document component and application CSS verifies selected passenger isolation, single/all print, close cleanup, saved reopening and no browser runtime errors. No real-account walkthrough performed.
- All-passenger PDF is two A4 pages for two ticket-bearing people; both pages rendered and visually inspected for complete rows, logo, dark-blue styling, notices and no payment section.
- Ignored QA: apps/web/tmp/reservation-ticket-*; retained prior Web build: tmp/reservations-ticket-web-before-0907. Local Web3100/API4000 restarted with existing settings and secrets retained.

## Follow-up

Real airline issuance/confirmed PNR and direct ticket PDF delivery require their own trusted issuance/output workflow. This change neither claims nor bypasses that lifecycle.
