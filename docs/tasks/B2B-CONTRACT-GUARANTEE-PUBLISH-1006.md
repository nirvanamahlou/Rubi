# B2B-CONTRACT-GUARANTEE-PUBLISH-1006

PC-B follow-up on the merged B2B contract upload flow. The user asks to move guarantee document upload into the guarantee form, remove the marked helper note, and replace draft-only save with a real save-and-publish action.

## Frozen behavior

“Publish” saves the agreement draft once and submits that exact saved revision for independent review. It does not approve or immediately activate a legal/credit agreement. The user previously selected an independent approver with agreement or credit permission, and the creator cannot approve their own request. Activation continues through the existing separate approval path.

The canonical Documents uploader will render directly inside each guarantee row instead of the `بدون پیوست` selector and nested upload disclosure. Existing attachment removal, exact document context, permission checks and scan feedback remain. The screenshot-marked note is the draft/approval helper in the agreement editor; only that note is removed.

The full agreement editor receives the `ذخیره و انتشار` action. Credit-only and guarantee-only sub-section edits keep their save-only action so changing a single sub-section does not unexpectedly submit a complete contract.

## High-consequence advice and contract

Risk is R3 because this crosses protected-document access and a legal/financial status transition. A read-only frontier advisor inspected source revision `0c2823f8cc6b661e858681a43bb2021434552ed2`; it raised no questions and reported implementation requirements CGP-A01 through CGP-A05. The source contract, accepted decisions, invariants and adversarial checks are frozen in [B2B-CONTRACT-GUARANTEE-PUBLISH-1006.contract.json](./B2B-CONTRACT-GUARANTEE-PUBLISH-1006.contract.json).

The local worker-orchestrator could not register this already-existing Compose checkout because its two registered workspace lanes are occupied, and explicitly refused replacing the ready-for-review lane. No other workspace was changed. The same assistant continues in this clean PC-B checkout with a read-only frontier consultation and a required fresh independent candidate review.

## Scope and verification

Bounded to the Organizations agreement editor/workflow panel and focused Organizations tests, plus this task's status and assignment entries. Save and submit use separate request identities and preserve the exact saved ID/version. A successful save followed by a failed or uncertain submit remains an explicitly reported draft and retries only the original submit. Confidential documents require new action-local `CONFIDENTIAL_VIEW` grants for submit. Actor, session, organization, authorized branch and editor generation are checked around async operations.

No backend/API contract, Documents policy, permission, schema, migration, dependency or operational data change is authorized. Focused and full Organizations tests, existing B2B workflow tests, scoped lint, affected typechecks/builds, a fresh independent exact-candidate review, and exact-head CI are release gates.

## Independent review correction — 2026-10-06

The first independent review of candidate `0b8302c3a4b1f6f1ff98fc8f8d9d674802519107` found two blocking lifecycle issues: async agreement work could continue after panel unmount, and a stale confidential-grant loop could request another document grant after the actor/session/proof context changed. The correction adds an explicit mounted/context/request/proof-scope lease, checks it after each grant response and before any later grant or command, and prevents stale grant responses from updating reference state. Deferred-grant and lease regression tests cover the boundary. The frozen behavior contract remains unchanged. Fresh independent review of source commit `1017b936749c4dcd59daff48ed84c0a49883e27e` reports NO_BLOCKER, resolves CGP-R01 and CGP-R02, and found no new regression in save/submit retry identity or the independent-approval boundary. Exact-head CI is the remaining release gate.

After syncing with refreshed `origin/develop@6c631406`, local verification passed: Organizations 207 tests, B2B workflow/idempotency/documents API 18 tests, Web typecheck, scoped ESLint, and Web production build (55 routes). No authenticated browser upload test or operational database/runtime change was performed.

Contract SHA-256: B7C61210771FED03C9468146C3786361A08CD014B289DC616838C1B4DCAEB920.

## Post-merge Compose closeout — 2026-10-06

PR #678 merged to `develop` as `57385c481aa750e1026c73936ab7727a5caa1d34` from source `153d3e47`. Exact-head CI passed for quality, the full test suite, production build, and PostgreSQL migration/seed; the independent source review reported NO_BLOCKER. The request implementation is running in the local Rubi Compose stack: web on port 3100 and API on port 4192. Both report healthy, `/login` returns HTTP 200, and PostgreSQL, Redis and MinIO remain healthy.

No database migration or operational record was changed. A read-only Prisma status check found two pending migrations, including a ticket-archive migration that changes status for unused duplicate offers and writes audit rows. That broader develop rollout is held until the operational data change is explicitly authorized. The B2B Compose image remains on the PR #678 merge revision. No authenticated agreement-upload browser test was performed.

At the user's direction, this post-merge Compose closeout continued directly without the worker-orchestrator.
