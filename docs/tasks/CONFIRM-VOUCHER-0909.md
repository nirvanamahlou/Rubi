# CONFIRM-VOUCHER-0909
PC-A, base 8297341. Scoped Reservations API/Web change.

The owner's revised workflow combines supplier confirmation and hotel voucher issuance in one versioned revision. The same transaction creates the existing ISSUE_VOUCHER notification for the Sales owner. The existing Finance document-delivery check still blocks Sales access until approval. Missing insurance requires explicit acknowledgement at confirmation. Existing confirmed-only records can still issue their voucher through the old command; no data migration or retroactive issuance.

The queue removes the separate supplier-confirmed option/legend. Historical rows retain a truthful ready-for-voucher label. Issued vouchers are dark gray. New arrivals have exact #FFC0C0 only behind their contract identity column in both themes, with dark readable text; whole-card selection is preserved. Visible MANIFEST labels are uppercase, including the form subtitle.

Validation: 12 API tests including atomic revision and same-transaction notification, legacy support, missing-insurance denial and Finance-gated HTTP access; 34 foundation tests. Browser computed-style checks verify exact new-column color and neutral remainder in both themes. Scoped lint, API/Web typechecks and builds passed; local API4000/Web3100 refreshed and health 200.

No migration, IAM grant or live contract mutation. The previously identified missing Reservations permission remains pending authorization. No merge. Preserve Web PDF environment and original API database/context keys.

Publication: automatic review rejected push. Read-only GitHub inspection reports isPrivate=false for the existing origin. Do not publish until explicit approval or destination privacy changes.
