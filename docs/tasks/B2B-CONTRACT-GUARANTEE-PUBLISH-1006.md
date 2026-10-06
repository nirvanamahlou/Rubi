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

The first independent review of candidate `0b8302c3a4b1f6f1ff98fc8f8d9d674802519107` found two blocking lifecycle issues: async agreement work could continue after panel unmount, and a stale confidential-grant loop could request another document grant after the actor/session/proof context changed. The correction adds an explicit mounted/context/request/proof-scope lease, checks it after each grant response and before any later grant or command, and prevents stale grant responses from updating reference state. Deferred-grant and lease regression tests cover the boundary. The frozen behavior contract remains unchanged; a fresh review of the corrected candidate and exact-head CI are still required before release.

After syncing with refreshed `origin/develop@6c631406`, local verification passed: Organizations 207 tests, B2B workflow/idempotency/documents API 18 tests, Web typecheck, scoped ESLint, and Web production build (55 routes). No authenticated browser upload test or operational database/runtime change was performed.

Contract SHA-256: B7C61210771FED03C9468146C3786361A08CD014B289DC616838C1B4DCAEB920.
