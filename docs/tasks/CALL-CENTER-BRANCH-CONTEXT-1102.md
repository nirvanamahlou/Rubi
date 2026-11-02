# Call Center employee branch context — 2026-11-02

COMPUTER_ID=PC-C. Work item CALL-CENTER-BRANCH-CONTEXT-1102.

## Root cause

The workspace used the first authenticated branch. Two shared-extension201 accounts had Academy first, while their active HR employee record and Issabel calls belong to Central Office. Demo and other accounts selected Office. Previous history verification selected the connection branch explicitly, so it did not exercise this UI bootstrap defect.

A fresh read-only PBX reconciliation found145 finalized external call roots since1405/08/09 already present. Both affected accounts could access21 outgoing calls today across13 contacts when using the correct branch. Contact rows group calls by number; they are not individual call rows.

## Change and boundaries

HR exposes the current user's active employee branches through its existing public request directory. IAM intersects them with active authorized branches. Call Center adds optional `meta.defaultBranchId` to its branch response, preferring the sole HR branch; manager fallback considers only calls already visible under existing access policy. The Web resolves this context before mounting the unchanged workspace, aborts stale requests and validates the returned branch against authenticated scope. No hardcoded branch or employee IDs, permission expansion, migration, historical rewrite or PBX change.

Two existing missing English labels were synchronized into the API and legacy catalogs after production-baseline translation coverage exposed them. No Persian labels or approved layout changed.

## Validation

-11 API focused tests passed;11 existing fixture-dependent database cases were skipped in the build environment.
-23 Web/client/model/i18n tests passed.
-Scoped ESLint, API/Web TypeScript and production API/Web builds passed.
-Candidate native read-only verification:16 employee accounts plus Demo,119 scoped contact checks. Both shared201 accounts selected their HR branch and returned all21 target calls in contact histories.
-Deployment remains pending: final Web execution smoke detected excessive layers in the inherited production image. Live services have not been changed. A concurrent peer develop deployment holds the shared lock; integrate against its final runtime before releasing.
