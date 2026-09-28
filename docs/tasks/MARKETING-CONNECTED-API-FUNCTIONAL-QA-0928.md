# MARKETING-CONNECTED-API-FUNCTIONAL-QA-0928

## Scope and evidence

Owner: PC-B. Base: `origin/develop@4013211f`. User confirmed Marketing and its
connected paths, with particular attention to form submission. Existing Marketing API
only publishes `GET /marketing/process`; current campaign, segment, audience, source,
offer, coupon, and message forms do not persist records. Focused Marketing tests pass
but do not exercise a form write/read round trip.

## Frozen security contract for Marketing content assets (v1)

The current generic Documents upload requires `documents.list` and
`documents.upload`, which Marketing roles lack. Granting those permissions would expose
unrelated document metadata and client controlled source relations.

1. Authenticated `POST /marketing/content/assets` accepts only a file, a branch in the
   actor's scope, title, optional description, and a server allowlisted kind. It requires
   `marketing.content.manage`. A marketing only actor must not gain generic Documents
   permissions.
2. Documents owns storage, scan, audit, type/category lookup, owner and source fields.
   Marketing calls a narrow public Documents method. The saved relation is exactly
   `MARKETING / MarketingContentAsset` with a server generated UUID, configured BRAND
   document type, BRAND_ASSETS category, authenticated owner and INTERNAL visibility.
3. Reading a Marketing asset requires exact source, branch, BRAND domain, active state
   and clean scan for download. Generic `/documents` routes remain denied to a
   marketing only actor. Client supplied document IDs, owner or source fields are
   ignored or rejected.
4. Missing BRAND configuration, invalid kind/file, zero or oversized file, forged MIME,
   and cross branch access fail closed. A pending/quarantined scan may return persisted
   metadata with a non-ready status, but must not be reported as a usable file or permit
   download. No PII or customer records are stored in Marketing.

Required tests: successful marketing only upload and subsequent scoped read; 403 for
missing Marketing permission, generic Documents routes and cross branch access; 400
for invalid file/configuration/kind; denied read/download of unrelated or quarantined
documents. Producer and consumer are Marketing API/Web and Documents public service;
the new permission is additive and existing Documents clients remain compatible.

## Lead registration invariant

Each distinct manual lead submission receives a unique stable source reference. A
repeat with the same source reference is an idempotent replay only when the original
request matches; conflicting payload must return 409. Branch scope and encrypted
contact handling remain unchanged.

## Deferred infrastructure

Campaign, segment, audience, source, offer, coupon and message persistence needs
Marketing owned schema/migration and an approved Customers audience/consent contract.
No success notice may claim these forms were saved or a message sent until the backend
write/dispatch exists. Actual round trip testing will be performed when those contracts
and storage are implemented.

The offer target selector currently invokes broad Customers and Master Data list APIs;
marketing only roles receive 403. Granting `customers.read` or `master_data.read` would
expose unrelated records. A narrow cross-owner target lookup contract with branch,
active state, consent and suppression checks is required before this selector can be
called operational. No customer contact or identity fields may be persisted by Marketing.

Content assets are limited to PDF, PNG, JPEG and XLSX with a kind-specific allowlist.
Video, audio and HTML/message template uploads remain deferred until the Documents
type, MIME sniffing and scan policy can accept them safely. Marketing previews still
need a separate Marketing-owned persistence model and approved migration before
campaign, segment, audience, source, offer, coupon, automation and message forms can
be tested for a real write/read round trip. The UI must label those interactions as
preview-only in the meantime.

## Implemented and verified in this slice

- Marketing content uses a narrow Documents service boundary. `marketing.content.manage`
  authorizes upload/options without granting generic Documents access; list/detail/
  download require `marketing.read` and exact branch, source, BRAND, active and scan
  checks. Generic Documents upload rejects the reserved Marketing source tuple.
- Upload outcomes distinguish CLEAN (201), pending scan (202), and terminal blocked
  scans (409 with persisted asset metadata). The library reloads from storage, loads
  later pages, labels blocked assets and disables their downloads.
- Manual Lead intake uses a unique source reference and stable retry key; a different
  request colliding on the source returns 409 rather than falsely replaying an old Lead.
- Marketing preview forms no longer claim a backend save/send when there is no write API.
- Focused API tests: 57/57 across 10 files; Web tests: 41/41 across 8 files. Scoped API
  and Web lint, Web typecheck, Web production build (53 routes), and contracts build
  passed. No operational database or
  browser-authenticated end-to-end round trip was run. The full API typecheck reports
  existing Finance, Procurement, Reservations and Ticket Catalog schema/type errors,
  not Marketing or Customer Affairs errors after this slice's fixes; API production
  build also stops on those 96 out-of-scope errors.
