# HR-014 — Backend integrations without a separate connections panel

COMPUTER_ID=PC-B. Branch: `codex/pc-b-hr-backend-only-0912`, base `origin/develop@6a4e0410`.

The user clarifies that integration means backend data relationships used by normal forms, not a separate referral workspace. Remove the global HR connections outlet, its lazy workspace and client, its presentation-only tests, and the HR detail referral link. The legacy query parameter no longer opens any UI. Preserve existing detail navigation and the invisible visibility context still consumed by Organizations.

Backend HR connection services/controllers, shared contracts, receiving permissions, persisted records and all IAM/Master Data/Documents/employee reference integrations remain unchanged. No migration, dependency change, account mutation or data deletion. Backend execution beyond what already exists is not implied by removing UI.

This work reserves only the specified AppShell edit and HR-local presentation files plus task documentation. It does not take over the shared Web3100/API4190 runtime. Under the updated repository instructions, push a review PR to develop without automatic merge.

Validation: Web lint and typecheck passed; all 260 existing HR/Organizations/layout tests passed (41 files); production build passed with 46 routes. Search confirmed no remaining UI panel imports, labels or `hrConnections` links; backend, contracts, database and lockfile paths have no diff. No new tests were added for this presentation removal.
