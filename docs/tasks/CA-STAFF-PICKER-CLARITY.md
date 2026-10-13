# CA staff picker clarity — PC-B — 2026-09-13

Scope: CA-only UI and tests, no schema/API/HR/IAM or data mutation.

Date labels are `از تاریخ` / `تا تاریخ`, including accessibility names.

The forms already consume authenticated `/hr/directory`, scoped by the HR service to active employees and actor branches. The picker previously filtered out every employee without `userId`. The CA owner/referral fields persist user references, not employee references. Substituting employee IDs or inventing account links would violate that contract.

The picker now retains unlinked employees as disabled options with a Persian explanation, adds loading/error retry, and checks selected values against returned user IDs. Existing assignments are preserved. All create/edit/referral consumers reuse this picker. Making unlinked staff assignable requires an explicit accurate employee-to-existing-account mapping in HR; this task does not claim that configuration is complete.

Initial suite: 46 passed, two date render tests exceeded their default timeout during concurrent checks. Isolated rerun of the two affected files: all five tests passed. Scoped ESLint, standalone TypeScript and production build (46 routes) passed. Scope reservation released; deployment and account mapping remain pending.

Runtime: HR coordination task prepared `codex/pc-b-hr-panel-runtime-0913` at c0145d08 (implementation a74172c1) but reported the Web cutover blocked by execution policy. No attempt to bypass/retry that cutover here. Current CA source branch is based on b1da23bd and does not include that HR panel-removal patch; any next combined activation must preserve both branches' changes. New-label live browser verification is not claimed.
