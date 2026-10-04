# B2B-SIGNATORY-UPLOAD-1004 frozen contract v1

PC-B, R3/C3. User requests in-form authority proof upload, notes below and manual activation after upload without human review. Source investigation proves no existing human-review gate; reviewedAt is antivirus metadata. Preserve backend assertDraftReference and all owner policies unchanged.

- Reuse Organizations inline upload and canonical organizationDocumentForm/Documents API, exact current organization and authorized branch, domain/type/owner/classification/expiry rules. Require upload plus existing proof attachment capabilities. Honor confidential code requirements without lowering classification.
- Notes below proof use existing persisted signatory notes (1000-char maximum). No new field/schema.
- HTTP upload initially awaits antivirus. Activation remains disabled until exact uploaded document is ACTIVE, CLEAN, complete, unexpired and eligible for this organization/branch with pinned current version. Never auto activate; manual checkbox only. Existing backend freshly validates save.
- After successful upload refresh exact-source list, polling immediately then delays2,4,8,15,15 seconds at most; stop on eligibility or terminal rejection. After bound retain pending state and offer explicit retry/refresh. No auto reupload after uncertain outcome.
- Upload/list/poll callbacks bind organization, branch, session and editor generation; discard after close/identity change/unmount. Merge proof fields into current editor so notes/contact edits are never overwritten. Never enable activation from stale, failed, uncertain, quarantined, infected, incomplete, expired or mismatched results.
- Upload in progress or uncertain resolution blocks Save. No uploaded file means existing inactive save remains possible. Existing eligible proof selection remains available. Failed upload supports deliberate retry, uncertain outcome requires reconciliation rather than duplicate upload.
- Truthful statuses distinguish uploading, waiting security scan, ready and failure; no human-review assertion.
- Additive local shared uploader/dialog props default to current caller behavior; preserve others and no dependency/schema/API changes. Meaningful regressions cover permission, context switching, delayed completion, edits while uploading, pending/terminal/eligible proof and save gate.

Advice: /root/contact_display_advice, implementation: /root/phone_verification_impl; independent final review of committed candidate required. Usage unavailable. Polling policy is routine bounded UI choice. User decision removes no security scan gate because there is no human review prerequisite to remove.
