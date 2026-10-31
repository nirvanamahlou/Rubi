# COMPOSITE-VOUCHER-1031

PC-A. User authorizes implementation and develop merge. No server rollout, migration, dependency or business-data change.

## Result

A combined voucher now includes every ordered hotel from the immutable contract itinerary. Each hotel has its own A4 section/pages with hotel name, city, dates, room-type/category rows, adults/child ages/guest counts and the existing passenger service table. Primary voucher overrides remain primary-only. Additional hotels read their own contract room composition and dates, preserve selected passenger identities/common voucher options and do not inherit the primary custom passenger stay dates. Flight-only passengers have no hotel dates. Historical additional stays without room details do not borrow the first hotel's room type.

The preview and PDF share one read-only document/pagination plan. Room appendices belong to the correct hotel, page numbers run continuously through the single PDF, and no supplied contract/workflow object is mutated. A pre-scoped supplier form remains a single hotel document. Both preview and PDF load the references for every hotel, city and room type so their English names remain consistent. Existing request authorization, issued-voucher checks, public-link handling, branding and finance policies remain in their original routes.

Disabled hotel sections are omitted in PDF as in preview. The one existing PDF assertion for a fixture with no hotel and a disabled hotel flag now explicitly checks this behavior; the earlier Jahan branding reservation had already merged as PR1218 before this bounded test update.

## Verification

Model, preview markup and PDF markup regressions cover two and three hotels, independent room layouts/dates, primary overrides, selected and flight-only passengers, custom primary stays, historical missing rooms, hidden hotel sections, input immutability and room appendix numbering. A route regression verifies secondary hotel/city/room reference loading before download under the existing workflow checks.

Actual synthetic Chrome PDFs were rasterized with Poppler and visually checked: the normal two-hotel document has exactly two physical A4 pages; the six-room/six-passenger case has exactly six physical pages, including the correct hotel-specific room appendices. Tables, dates, service rows and counters fit without clipping or overflow. These diagnostics contain no operational customer information and are not shipped.

Final local lint/types/build and hosted quality/tests/production-build/PostgreSQL checks gate the user-authorized develop merge. The task does not change a live runtime.
