# SITE-AIRLINE-LOGO-1115

Owner approval: publish only sanitized airline brand images used by published NSS products, including source brands in other branches. This grants no account membership, document URL, filename or general cross-branch access.

Producer contract: the existing version1 signed catalog adds airlineLogos entries {sha256,mimeType:image/png,dataBase64}. Exact active airline matching accepts only the attached BRAND/INTERNAL/active/complete/non-confidential/unexpired source through a purpose-specific Documents port. Native scan and file-delivery policy remain. The source is rechecked after reading and audited.

Images are decoded under a20-million-pixel bound, resized within256x256 and re-encoded as PNG without metadata. Limits are32 unique assets,256KiB each and768KiB total decoded, further bounded by remaining space in the existing4MiB snapshot. Missing/invalid/denied images retain the product and name fallback. Static URLs use https://niyayeshseir.ir/api/v1/erp/airline-logos/{sha256}. The receiver validates/stores the latest signed snapshot and serves local bytes without ERP requests on visits.

Only current airline-attached document changes queue NSS invalidation. An additive migration covers document, version and exact relation changes including removal; no operational data backfill. Other channels and unrelated documents are unchanged.

Validation:160 focused API tests pass, including normalization, metadata removal, MIME/magic/size restrictions, limits, deduplication, exact carrier matching, policy refusal and version race. An isolated PostgreSQL proof validates seven logo revision events and no unrelated-channel/document invalidation. API build/typecheck and hosted exact-head CI remain the rollout gate. No ticket issuance/payment/contract mutation is used for acceptance.

Runtime preservation: current production payment-state and settled-document-release overlays remain in the guarded runtime merge. Deploy only the API, preserving Web, Worker and protected site binding. Native ticket output already renders logoDataUrl, but its branch-limited source requires separate website-output verification; catalog delivery does not prove issued-file output.
