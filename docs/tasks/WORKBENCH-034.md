# WORKBENCH-034 — persistent Workbench feedback

## Behavior

The Home feedback form now submits an authenticated request instead of retaining a browser-only draft. The API validates the actor's branch, trims and bounds subject/body, validates up to ten Documents-owned attachment identifiers, records an idempotent feedback row and returns a tracking number. The selected department is limited to Finance, Reservations, Sales, Visa, Human Resources and Management.

HR resolves active linked user accounts in the destination branch and department through its public directory service. If the HR fixture has no linked account for that department, active branch administrators are the delivery fallback. Notifications are created in the feedback transaction. Named submissions carry the sender as notification actor; anonymous submissions use a null actor and never put the sender name or identifier into the notification content. The database retains the submitter FK for audit and incident handling.

Each notification links back to the authenticated feedback detail endpoint. The sender and authorized members of the destination department can read the full subject and body from Workbench; other branch users receive a not-found response. Recipient views of anonymous feedback omit the sender projection, while the sender can still see their own audit receipt.

Optional PDF, PNG and JPEG files are uploaded through the existing Documents endpoint before feedback registration. Their source reference contains the client-generated feedback UUID, and the feedback service accepts only active documents owned by the actor in the same branch with that exact reference. Existing antivirus, confidentiality and document access rules remain authoritative. Anonymous uploads use restricted confidentiality; the UI also warns that a filename or file content can identify the sender.

## Migration and runtime

Migration `20260912173000_workbench_feedback` is additive: one enum, one table, restrictive Branch/User FKs, a bounded attachment-count check and lookup indexes. It was rehearsed successfully on full restored copies before application. The active runtime database backup is `C:/Users/admin/Rubi-backups/workbench-feedback/runtime-before-20260912-031255.dump` with SHA-256 `2B092D3E6584033E4F4B54FE62E1D5A339DB5D4076CE3B35D90D7CD321559912`. The production-style local migration preserved 38 IAM users, five branches, 44 documents and six HR employees; feedback count remained zero because QA did not submit a representational test record.

Web3100 serves build `hr005-445b3dde58420270`; API4190 is healthy and uses the existing `rubi_hr_current_20260908` database and `hr007-documents` storage. Authenticated browser inspection confirms the obsolete draft/unavailable text is absent, attachment persistence copy is present and the submit button is enabled. The unauthenticated endpoint returns 401.

## Validation

- API: 1,222 passed and 135 opt-in skipped; six focused service/repository tests cover branch scope, attachment validation, anonymous notification actor, idempotency, anonymous recipient projection and unauthorized detail access.
- Web: 1,319 tests passed in the full parallel run; two pre-existing HR rendering tests timed out at five seconds under concurrent host load, then both files passed all 54 tests in isolation. All 44 Workbench tests passed separately.
- Database: 73 tests passed. Contracts: 68 tests passed.
- Affected lint and TypeScript checks passed. Contracts, Database, API and the 46-route Web production build passed.

No IAM grant, password/session change, external delivery, or synthetic feedback submission was performed.
