# SALES-CONTRACT-THEME-ROOM-0907

- PC-A; local branch codex/pc-a-sales-customer-pricing-0907; base 5daa1a4.
- User clarified that section 4 room type must come from the selected hotel's Master Data room product, not the passenger accommodation category, and requested closer reference styling plus its contact footer while retaining all prior rules.

## Changes

- Hotel section resolves hotelSelection.roomTypeId through the existing public Master Data names map, already loaded by preview and PDF. Passenger section still uses each passenger's DBL/child-bed/infant accommodation classification. Missing references remain explicitly unavailable; no passenger-category fallback or inferred room product.
- Large Persian heading on the right, agency branding on the left, navy gradient and teal rule, left-side two-digit section badges/English headings, right-side Persian headings, pale table headers, outlined signature boxes and three-column financial summary follow the supplied reference.
- Preserved all existing fields and business calculations, per-passenger IRR/foreign amounts, English monetary digits, agency-only commission, confirmed-Finance-only settlement and all three user-supplied notices.
- Footer adds icon-labelled Nystkt.ir, 021-72075000 and support@niyayeshseir.com as explicitly requested from the reference. Phone/email are restricted to NIYAYESH_SEIR_SAHAR issuer; not assigned to other companies. The existing issuer company name remains dynamic. These are presentation contact details, not a new public-contract verification endpoint.
- Consolidated accumulated template CSS. Static B Nazanin font-face now declares normal weight in both browser and embedded PDF so bold headings synthesize consistently. PDF sandbox/network isolation, permissions and data source unchanged.
- QR remains deferred to future server-hosted per-contract viewing/verification, as agreed in the prior task. No dummy QR or publicly accessible passenger record.

## Verification

- 161 Sales Web tests, scoped ESLint and Web typecheck passed. Added separate hotel-reference/passenger-category and issuer-contact guard regression coverage.
- Actual production renderer generated four synthetic PDFs: 2, 6 and agency-6 passengers each fit one A4 page; 42 passengers span two pages. All five final pages visually reviewed, including repeated passenger header, complete continuation, readable footer and notices.
- Production Web build/startup result is recorded in central status. Ignored QA: tmp/pdfs/theme-room-0907. Prior Web retained at tmp/contract-theme-room-web-before-0907.
- No migration, dependency, API, producer, IAM or real-customer data mutation. Existing saved contracts render through the corrected template; previously downloaded PDFs must be downloaded again. Local commit only; no push to the known-public remote.
