# Site publication and update delivery

ERP owns product definitions, sale prices, capacities and publication controls. The nss binding fixes the allowed branch. New tour price publications and untargeted standalone ticket prices in that branch create a website publication; other branches are excluded. Repricing never re-enables an explicitly removed listing. Existing listings can be published explicitly through their controls; historical products are not bulk enabled.

WebsitePublication gains salesStopped. Publish/resume sets enabled=true and salesStopped=false; pause leaves enabled=true and blocks new drafts/quotes; remove sets enabled=false and preserves products, bookings and audit history. Version checks reject conflicting edits. Existing disabled/enabled API clients remain compatible.

An additive PostgreSQL coalescing outbox increments in the same transaction as catalogue-relevant ticket/tour, price, capacity and reference changes. The API dispatcher examines only that local durable state, sends a signed complete version1 snapshot when dirty, and retries failed deliveries. It also schedules the next active capacity-hold expiry. Publication response need not wait on website availability. Snapshots contain the existing public sale projection, not purchase costs or passenger information.

The site verifies HMAC-SHA256 over timestamp.raw-body, rejects stale signatures, scope errors and oversized payloads, and atomically replaces only older local revisions. Deletion is represented in the complete snapshot, so out-of-order deliveries cannot restore removed products. Every page/catalog visit reads the site's own database. Actual order creation retains authoritative ERP price, publication and capacity validation; verified-payment retry remains separate.

Deploy additive migrations before the matching API; configure one shared random secret only on the two hosts. Preserve prior images, source and a database backup. Do not downgrade the additive schema on rollback. Gateway activation, real purchases and historical bulk publication are outside this task.

Validation: site authentication/tampering/replay/removal/no-per-visit-ERP tests and existing commerce tests; ERP dispatcher unchanged/pending/signed receipt and stopped-sale tests; isolated PostgreSQL branch, auto-publication, no-resurrection and capacity invalidation checks; API and Web production builds. Runtime acceptance must confirm delivery and health without making a real purchase.
