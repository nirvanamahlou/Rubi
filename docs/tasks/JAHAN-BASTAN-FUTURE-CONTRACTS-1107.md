# Future commercial contracts — disabled

Version: `jahan-bastan.nora.business.v1`. This is a design contract, never an
enabled API, worker, queue or promise of later processing. The production router
rejects commercial commands and all incoming events with HTTP 501. No flag can
connect these routes to commercial handlers. A separate reviewed implementation,
migrations, producer/consumer tests and owner release authorization are required.

| Operation | Nora owner | Website ownership | Current state |
|---|---|---|---|
| Central products, prices and capacity | Ticket Catalog / Master Data public contracts | Native publication/validation | DISABLED |
| Orders and service/passenger allocation | Sales Contracts | External source identity | DISABLED |
| Contracts, acceptance and amendments | Sales Contracts | Versioned website terms acceptance | DISABLED |
| Payment, installments, refund, settlements | Finance/Treasury | Source facts and provider references | DISABLED |
| Availability, hold and reservation | Reservation Operations | Native source availability | DISABLED |
| Supplier purchase and procurement | Procurement | Supplier adapter evidence | DISABLED |
| Tickets and vouchers | Reservation Operations | Source-issued identifiers | DISABLED |
| Document permission and delivery | Documents / Sales financial release | Site-owned source artifact | DISABLED |
| Accounting | Finance Accounting | Read-only source evidence | DISABLED |

The strict FutureEnvelope schema includes siteId, organizationId, legalEntityId,
branchId, actorId, orderId, serviceLineId, exact decimal amount, currency, version,
eventId, operationId, correlationId and termsVersion. A site, brand, installation
organization, legal issuer and operational branch are separate identities.
The persistent installation organization UUID is an integration namespace; it is
not a guessed legal company registration or a Nora branch identifier.

Nora must resolve actor and permitted branch from its authenticated server session.
Neither body actorId nor browser headers establish identity. Legal-entity mapping
and Jahan Bastan's approved sales/acceptance/amendment/refund conditions must be
versioned before implementation. Existing native terms_version/terms_accepted_at
facts remain site-owned. This design does not invent legal terms or acceptance.

Future delivery requires transactional outbox/inbox, uniqueness by source site,
organization, handler and event ID, payload fingerprints and stored terminal
results. The same ID/content returns the previous result; conflicting content is
rejected. Version regressions never overwrite newer data. Identity/key rotation
and process restarts do not change an operation's identity. Idempotency keys must
include the service line, passenger/installment/issuance intent when those are
independent valid operations; an order-level lock must not suppress legitimate
multiple installments, passengers or services.

Timeout means unknown outcome. Payment/purchase/issuance must be reconciled by
the stable upstream operation/reference before any new side effect. Retries must
never create another payment, supplier purchase, journal or issued document.
Receipt of an event is distinct from successful execution. Unsupported messages
are rejected immediately, never acknowledged or accumulated in a business queue.

The active connector only executes synchronous native catalog commands. The native
mutation, safe actor audit and durable replay result commit together. Workbooks
store encrypted, actor/branch/connection-bound previews; preview rolls back native
temporary writes. No active asynchronous business delivery requires an outbox.
