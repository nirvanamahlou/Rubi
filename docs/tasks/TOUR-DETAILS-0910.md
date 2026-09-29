# TOUR-DETAILS-0910

PC-A; isolated from active HOTEL-GROUP-RATES-0910. Base14ec087 preserves the integrated local feature stack. No schema, migration, dependency, IAM grant, live data change or public publication.

## Definition

Ticket Management tour creation now includes title, summary, description, required documents, services, installment/refund text, registered destination/origin, origin airport selection or manual uppercase IATA, duration, rating, descriptive transport/airline, ticket-included flag, existing direction-specific included airport transfers, base price/currency and optional separate flight price/currency. Prices are exact decimal strings; Toman is an input unit converted exactly to IRR, not an additional ledger currency. Airline name is a descriptive snapshot selected from Master Data, not an invented identity or inventory reference.

Ordered itinerary supports add/remove/reorder (up to100 stages). Stage type/title/location/stay days/start time/duration/transport/class/baggage/description are optional. Only relative wall-clock HH:mm is stored, not a fabricated absolute departure date. The separate dated occurrence/repeat-week flow and shared ticket capacity are unchanged. TRAIN describes a template only: executable train inventory/departures are not implemented or claimed; current departures still require published flight offers and the form explains this limit.

Optional `details.version=1` is backwards-compatible on TourPackageInputV1. API Joi validates the complete object, rejects unknown fields, invalid times/durations/amounts and preserves itinerary order. The existing TourPackage.definition JSON persists it and existing list/detail projection returns it. Saved tour details are viewable under the selected occurrence's definition summary. Definitions remain immutable; changing the template means creating another definition, as before. Catalog prices do not overwrite agreed Sales contract prices or purchase costs.

## Image

Reuse public Documents upload dialog/client; only BRAND image types are offered. Binary stays with Documents. The selected document must be active, same-branch, PUBLIC/INTERNAL, no step-up, PNG/JPEG, CLEAN, and readable by the actor; backend rechecks via DocumentsService before persisting its identifier. Pending scan offers explicit recheck rather than accepting an unscanned image. Removing the association never deletes the archived document. Viewing uses the existing archive link and its normal access gates. No real image was uploaded during QA.

## Verification / activation

41 API policy/service-boundary tests and99 Ticket Web/Sales consumer tests passed. Tests cover exact Toman conversion, ordered definition persistence/projection with a mocked repository, backwards compatibility, invalid data, image branch/domain/access/scan/type denials, and rendered form controls. Scoped lint and API/Web typechecks passed; API build and40-route Web production build passed. No live authenticated browser or PostgreSQL integration run is claimed for this slice; no migration is needed.

Web3100/API4000 belong to the active Reservations work. Neither listener nor that dirty worktree was modified. Coordination sent to task «توسعه پایه رزرواسیون» for ownership/handoff. Source is ready for integration after its work is safely committed; do not replace its runtime with this earlier isolated base. Keep both histories and run combined checks before activation. Public origin publication remains on the previously documented hold.
