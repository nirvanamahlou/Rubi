# PAYMENT-HOLD-1117 — checkout capacity protocol v1 (implementation in progress)

Producer: ERP Ticket Catalog and new isolated Site Commerce checkout controller/service. Consumer: site owner chat کار سوم. Main owns financial settlement PR1767; no concurrent mutation of its paid/controller or its staged signed-receipt consumer. No public checkout hold API is deployed yet.

## Agreed scope and identity

A website proforma does not create an ERP SalesContract, Customer or buyer. WebsiteCheckoutSession is an operational, server-scoped lease keyed uniquely by (siteCode, bound branchId, external checkout ID). Its ID is a real FK from native TicketOfferCapacityHold. Sales contract FK remains null until authoritative bank verification and creation/binding of the real WebsiteOrder. Contacts are only for protected operator capacity roster, never public offer projections.

Base route: `/sales/site-commerce/v1/:site/checkouts/:externalId`, existing authenticated site principal and exact server site/branch binding. POSTs require existing JSON write guard. No browser-provided branch, offer capacity, prices, expiry extension or arbitrary contract IDs.

### POST hold

Body: `{productIds: [publicationUUID, returnPublicationUUID?], birthDates:[YYYY-MM-DD], customerExternalId:string, requesterName:string, requesterPhone:string, rooms?:[{publicationId:string,roomCode:string,passengerIndexes:number[]}], expiresNotAfter?:ISOtimestamp}`.

Ticket publication IDs resolve to scoped published native offers/target tariff. Tour publication resolves to both native flight legs and current published package/room rows; room assignments and child bands must be checked by native published-sale policy. Adults/children occupy seats; seatless infants do not. All selected offers lock in stable ID order; both directions hold or neither holds. Deadline is min(server first prepare +10min, optional earlier invoice deadline). Repeat external checkout with same immutable composition returns the same snapshot/expiry; changed composition rejects409. Expired lease requires fresh price/checkout, never silent refresh extension.

Response `{version:1,data:{id,status,expiresAt,remainingSeconds,seatCount,offerIds,quotes,priceComponents,paymentPending}}`. `quotes` is flight quote legs (a paired total counts once); `priceComponents` is actual total by currency, including selected rooms for tours. No guessed exchange or child discounts. Pin compares frozen server quote against the site's immutable local proforma before any bank token can be returned.

### POST payment-attempt

Body `{attemptKey:string}` (consumer uses stable payment.res_num). Pins all existing active unexpired lease holds atomically. Replay of same attempt does not renew deadline; another unresolved attempt rejects409. No valid hold/pin => no bank token. Bank-uncertain holds remain inventory after ordinary ten-minute deadline per explicit user selection on2026-11-17. They are shown separately as waiting for bank, with operator visibility and reconciliation; closing a tab or refreshing cannot release/renew them.

### POST resolve

Success body `{attemptKey,outcome:'VERIFIED',gatewayReceipt:VerifiedGatewayProof}` reuses PR1767 authoritative bank proof verification bound to same site/external checkout/principal/branch/amount/terminal/reference. Marks verified; NEVER releases capacity on successful payment. Durable bank facts commit on site before any ERP writes.

Failure proposal `{attemptKey,outcome:'FAILED',failureProof:{version:1,terminalId,checkedAt,bankReference,bankOutcome:'NOT_PAID'|'REVERSED_CONFIRMED',signature}}`. HMAC-SHA256 uses the same server-only SITE_GATEWAY_SETTLEMENTS site binding secret and canonical UTF8 JSON array `["checkout-hold-result-v1",site,externalId,attemptKey,"FAILED",terminalId,checkedAt,bankReference,bankOutcome]`. Signature binds a durable authoritative bank outcome, not a browser flag. Repeated identical outcome is idempotent. A verified/bound/consumed lease cannot be downgraded/released.

**Do not release merely because local state says failed or VerifyTransaction returned an arbitrary error.** A definitive bank not-paid/reversed outcome must be verified against official bank semantics; amount/terminal mismatch, network errors, unknown ref and ambiguous verification remain held/review. No guessed bank inquiry endpoints or codes. Unresolved abandoned bank attempts require bank inquiry or authorized reconciliation, not blind timer release.

### POST bind-contract

Body `{}` after successful proof and idempotent real draft creation using the same externalId. ERP resolves matching WebsiteOrder itself and checks branch/site, flight legs, seated age counts, frozen prices and buyer facts; no caller-chosen contractId. Binds same native holds to that real contract. Replays retain binding. Then existing paid/native Sales.confirm converts own holds into allocation under the exact same offer row locks/transaction, removes double counting and preserves frozen validated quote. No gap releasing inventory between hold and allocation. Other checkouts/ERP manual reservations count all active/pending-bank holds.

## Validation/release gates

Schema/migration validation; all-channel capacity predicates/reporting; concurrent-last-seat PostgreSQL tests, two-leg rollback, replay, expiry, pending-bank beyond expiry, failed bank release, successful consume exactly once, scope/contact privacy, zero-seat infant; no production financial test data. Source/runtime CAS and host shared locks; consumer fail-closed until producer/migration/CI/deploy verified. Main settlement gates remain mandatory. This document is not a release claim.
