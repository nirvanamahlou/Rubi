# FLIGHT-TICKET-LAYOUT-1015 — PC-A

User authorizes airline English names, actual airport IATA codes, aligned destination, centered flight duration/number and automatic editable flight numbers, followed by develop merge.

## Boundaries

- Shared ticket renderer uses the directory-resolved English airline name in header, metadata and each leg. Unavailable directory metadata never invents an airline or airport.
- Public Ticket Catalog adapter reads selected airport references and their canonical IATA attributes, falling back only to a valid legacy three-letter airport record code. City codes are not substituted for airport codes; legacy flights without selected airports remain blank.
- Both place blocks share the same top anchor and minimum height; flight facts are centered under the route arc. Preview, browser print and server PDF share the layout styles.
- Flight numbers default to each immutable Sales flight snapshot. Authorized Reservations users may save per-flight output overrides; E-Ticket numbering is unchanged.

## Additive contract and rollout

Optional `TravelWorkflowStateV1.ticketFlightNumbers` and action `TICKET_FLIGHT_NUMBERS` use existing immutable workflow revision JSON. Keys are produced by `reservationFlightOutputKey(serviceClientKey, offerId)`; command validates membership, printable number syntax/length, status, branch, permission and expected workflow version. Every saved revision records actor/time. Empty overrides restore automatic defaults. No new schema/migration/dependency.

Deploy updated Contracts/API before Web. Older saved workflows and clients remain compatible. Reservations preview/print and Finance-gated Sales/Reservations PDF outputs consume the persisted overrides. No operational database or local runtime deployment is part of this task.

## Verification

Targeted tests cover actual IATA attributes, English-name escaping, shared alignment rules, outbound/return defaults and overrides, immutability, manual save callbacks, permissions, stale/foreign/cancelled commands, actor-stamped revisions and PDF-route replay of saved values. A synthetic round-trip PDF was rendered through the production renderer and its rasterized page inspected for alignment, readability, clipping and page fit.
