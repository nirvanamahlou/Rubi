# Automatic sold-out website stop

COMPUTER_ID=PC-A. The human requests sending stop updates to all connected websites and removing exhausted tickets from purchasable results. Capacity/hold owners retain their arithmetic and payment-pending holds. This task consumes their authoritative remainingCapacity only.

- Effective catalog salesStopped is manual stop OR remainingCapacity<=0. capacityStopped is additive diagnostic metadata, not a database/manual flag.
- Manual unpublication/stop is never changed by a catalog read. On release, cancellation or capacity increase, a newer full snapshot restores automatic availability only if manual flags permit.
- Existing Offer/Allocation/Hold transaction triggers increment the same durable coalescing delivery revision. Existing per-site HMAC, monotone receiver revisions, retries and unpinned-hold expiry refresh remain.
- Receiver projection fails closed for exhausted or malformed ticket stock without modifying the signed stored snapshot. Existing search excludes stopped/empty tickets; stale pages still pass native purchase checks.
- No live seats, reservations, payment states or manual publications are altered for tests. Synthetic zero/last-seat/reopen/manual-stop/unpublish and signed two-site delivery tests precede guarded release.

No migration, dependency or new external channel. No changes to native reserve, private own-held checkout witnesses, financial settlement or pinned-hold release.
