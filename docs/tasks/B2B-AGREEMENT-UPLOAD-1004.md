# B2B-AGREEMENT-UPLOAD-1004 — frozen v1

PC-B; base 1ec451f30fc9b12dbb018bce6ff472679fe9287c. R3/C3. User authorizes requested presentation cleanup, functional draft-save repair, push and develop merge.

## Evidence and decisions

- AU-A1: draft prepare already allows pending security scans and pins the returned version; submit/approve require CLEAN and unchanged pinned proof. Preserve producer enforcement and financial approval authority.
- AU-A2: editor permits upload/select with list and organization-read, but draft attachment additionally requires documents.metadata.read. Align consumer preflight; never expand grants. This is a verified deterministic 403 path, not yet confirmed as the screenshot's exact failure.
- AU-A3: current agreement uploader omits context/uncertain callback support. Bind upload completion and save gates; unknown outcomes must not invite duplicate upload.
- AU-A4: remove screenshot-marked deposit explanation, global document guidance/refresh strip and optional changeReason textarea. Preserve existing stored changeReason; blank is valid on create. Workflow action/review reason stays required. Relocate document pagination and error retry so older documents remain selectable.

## Scope and invariants

Organizations agreement terms editor, workflow caller, cooperation-draft preflight/model and focused tests; existing local inline-uploader capabilities reused additively. No producer API, shared contract, permission grant, schema, dependency, operational data or Documents policy changes.

1. Canonical Documents uploader with exact organization/authorized branch/source/domain/type/classification/expiry/access-code. Existing attachment capability including metadata-read must be enforced before attachment upload/select.
2. Preserve unrelated editor values when upload completes; merge proof identifiers into the current exact target. Contract and each guarantee must retain their independent IDs. Bind actual actor, organization, branch, editor generation and guarantee target. Same-identity focus refresh preserves upload state; refreshed authorization blocks new actions until ready. Actual identity/target changes discard stale callbacks.
3. Busy or unknown upload result blocks Save; bounded explicit recovery, no automatic re-upload. No success claim until actual successful attachment/draft response. Existing idempotency/version handling stays intact.
4. Draft can retain pending-scan valid exact-source complete proof through existing API; submission/approval still require CLEAN current pinned version. Failed/infected/incomplete/expired/cross-context proof denied. Never automatically mark guarantee RECEIVED or turn DEPOSIT_REQUIREMENT into money receipt; preserve credit.manage and maker/checker.
5. Remove only requested copy/optional field UI; keep payload compatibility, validation messages, upload status/error, pagination and retry. Existing optional notes remain.

## Acceptance

Meaningful tests cover metadata denial before attach; valid contract+guarantee IDs saved in one draft, empty reason, pending draft versus strict submit; stale completion/current-value merge/slot identity, busy and uncertain save gates including same-identity refresh; documents beyond first page and error recovery. Run focused and full Organizations tests, relevant existing API proof/workflow tests, scoped lint/format, Web typecheck and affected build. Independent exact-committed-candidate R3 review required with AU-A1/A2/A3/A4 explicit disposition. Browser/live exact screenshot reproduction must not be claimed without evidence. Usage unknown.
## Frozen v2.1 — 2026-10-04 user Option 1

User explicitly chose fresh confidential-code access for each submit/approval actor. Initial attachment establishes a reference, never durable authority. Advisor contact_display_advice AU-V2-01..06 incorporated; no unanswered policy questions. Supersedes v1 consumer-only scope because masked metadata is not an eligibility source. R3/C4, same strong implementer; independent exact-candidate review required.

### Scope and owner contract

PC-B reserves Documents service/repository public opaque organization-proof/reference methods and focused tests; B2B agreement-documents/workflow/controller/DTO/service and regressions; Organizations agreement editor/workflow/actions/API/model and directly necessary InlineDocumentUpload capabilities/tests. Shared packages/contracts/src/b2b/agreement-workflow.ts additive optional referenceGrants only, Documents producer PC-B → B2B PC-B → Organizations Web; nonprotected old callers remain compatible. Existing Documents access-grant endpoint/policy reused, no schema, migration, dependency, permission expansion, other-module source or operational mutation.

### Frozen invariants

1. Documents owns authoritative proof eligibility. Validate authenticated permissions (list, organization read, metadata read; sensitive read where required), current branch membership, actual ORGANIZATION type domain, exact master-data/organizations PRIMARY_CASE relation, ACTIVE archive state, completeness and actual nonexpired validity. Return opaque document/version identifiers only. Never use masked GENERAL domain or masked null expiry to authorize a reference.
2. Draft accepts CLEAN/PENDING_SCAN/AWAITING_ANTIVIRUS_ADAPTER when other checks pass. Submit and approve require CLEAN and unchanged pinned current version. Each coded proof requires that acting user's current Documents CONFIDENTIAL_VIEW grant, bound to document/user/session/purpose/expiry; approver cannot use maker's token. User-facing submit/approve obtains a fresh grant using the code for that action. Existing tokens retain their existing five-minute reusable semantics; no new token consumption or durability.
3. Optional transient top-level referenceGrants supports at most21 distinct contract/guarantee document IDs. Reject malformed/duplicate/unrelated entries. Tokens/codes never enter persisted commands, terms, fingerprints, audit snapshots, URLs, browser storage, normal logs or echoed response/error bodies (the existing grant issuance response necessarily returns its token). Build persistence/idempotency command explicitly without transport credentials.
4. Stored pinned-version IDs must survive protected save/read/edit roundtrip. Use a bounded Documents owner reference-only method for exact stored versions with the original actor, organization and branch and existing required/sensitive permissions. It may resolve masked opaque IDs, not disclose protected names/expiry/type/file or grant attachment/action authority. General list/reference filtering is not widened. Every new/replaced attachment and state transition separately invokes owner eligibility/grant validation.
5. Preserve requestId/fingerprint for same semantic command when grants renew or response is ambiguous. A previously confirmed request replay acknowledges only its existing scoped result without another mutation or new disclosure; a new transition validates current actor grants. No duplicate agreement/version/transition on retry. Preserve independent maker/checker, credit.manage, CAS, strict financial/expiry/scan policy, and no guarantee/receipt autoactivation.
6. UI grant/code state is action-local and clears on close/success/actor/session/org/branch/proof changes. Existing canonical uploader exact slot binding and busy/uncertain save gates required; merge upload result into current values only, same-identity focus refresh preserves pending operation. Missing/expired grant, wrong code, stale proof, pending scan and upload uncertainty remain distinct recoverable errors. Never reupload a stored document solely because grant expired.
7. AU-A4 cleanup stays: remove marked deposit explanation, global guidance/refresh strip and optional changeReason UI; preserve stored optional reason and workflow reason requirements, error retry and older-document pagination.

### Acceptance and review

Tests must prove confidential contract+guarantee draft save/read/edit; real raw expiry rejected despite masked null; wrong document/user/session/purpose, missing sensitive permission and expired grant denied; independent approver fresh token; pending draft versus CLEAN submit/approve; changed pinned version rejected; grant renewal/ambiguous retries no duplicates; no token/code in persistence/audit/fingerprint/errors; slot/context stale completion and busy/uncertain gates plus retry/pagination. Focused then full affected Documents/B2B/Organizations tests, scoped lint/format, Contracts/API/Web typecheck/build. Independent reviewer new conversation inspects exact committed candidate and this hash; blocking findings return to same worker. No claim of live/browser QA without evidence.
