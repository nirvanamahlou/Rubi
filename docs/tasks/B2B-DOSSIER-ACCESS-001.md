# B2B-DOSSIER-ACCESS-001 — PC-B

Owner explicitly requested access to every agency 360 section after the commercial-dossier/branch permission error, continuing the concrete Nirvana access proposal. The HQ branch assignment was already valid. The local IAM catalog contained only the two B2B approval codes: all eight existing canonical B2B read/manage permission definitions were absent from this database.

## Applied local access

- Reconciled only the eight absent `b2b.*` catalog entries from `packages/database/src/permission-seed-data.ts`; did not execute the full seed or broaden the shared administrator role.
- Created `b2b-dossier-manager` with all ten canonical B2B permissions, including profile, agreement, credit and rate read/manage, plus independent agreement/credit review. Assigned this role only to Nirvana, preserving existing roles and HQ membership. Self-approval remains prohibited by the existing workflow even for a reviewer.
- The existing 21 relevant Master Data/Documents permissions already cover organization/contact/address editing/deletion, import/export/audit, organization and logo files, upload/download/version metadata and access history.
- Used the existing public IAM role and user-access services inside a serializable transaction, together with the narrow catalog reconciliation and audit records. The previous role sets and every other user's role/branch assignments were compared before commit. No password, session, credentials or other user access changed.
- Private pre-change and verified evidence: `C:/Users/admin/Rubi-backups/b2b-dossier-access`. The one-off maintenance helper is outside Git; no user IDs, credentials or session material are added to repository documentation.

## Verification

The resulting effective permissions, derived from IAM's assigned roles, successfully read the four live synthetic agency dossiers through B2B's public service, including the exact workspace call that previously produced the permission error. Each dossier returns its profile, three rates, one draft agreement and two addresses. The post-apply preview has no missing canonical B2B permission. The 36 targeted B2B service, HTTP authorization and independent-review tests pass.

Web3100 still serves aa964d6 / hr005-96235a5b777bc891 and API4190 remains healthy. No application code, build, migration or runtime process was changed. A page refresh retrieves the updated permissions; IAM resolves current grants on each authenticated request. The agent browser is at login, so no authenticated production browser session or credential bypass is claimed.

This resolves authorization for implemented dossier sections. Finance/Sales and organization-user integrations previously documented as unavailable remain implementation work, not a missing permission. Database access grants are local configuration and are not distributed by Git; another computer must separately administer its authorized account through IAM. This task branches from 1369efa on `codex/pc-b-b2b-dossier-access`; no merge is performed.
