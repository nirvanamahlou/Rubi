# Manual per-user access v3

Status: READY_FOR_REVIEW; live rollout pending explicit merge/deployment approval. Execution identity PC-A. Rebased onto origin/develop@2de87ce4. Draft PR: https://github.com/nirvanamahlou/Rubi/pull/806.

Approved specification: Rubi-Manual-User-Permissions-v3-fa.html, reviewed by the owner on 2026-10-12. Scope includes manual checkboxes, server enforcement, exact legacy mapping and a report of new ungranted capabilities. Passenger accounts are excluded. Agency passenger edits must preserve immutable names and organization ownership.

Design: introduce an explicit per-user snapshot, separate from shared role memberships. New snapshot authorization reads only its stored positive grants; shared roles cannot resurrect revoked grants. Legacy scope normalization runs before conversion. Screen/field controls are explicit and new catalogue entries default off. Existing native operation permission codes continue to be enforced at their domain boundaries. Preview/apply migration must be transactional, idempotent and compare effective authorization before/after. Unknown and inactive grants and branch memberships are retained. Title changes never assign or narrow permissions in manual mode.

Implementation: 24 manual editor groups; 310 page selections; 428 existing editable-field controls plus resource/subview controls. Existing operations remain native domain permissions. The dedicated Travel purchasing page is derived from its old Reservations/Procurement route decision during conversion. In manual mode it can be unchecked independently and the dedicated purchasing inbox/cost API is gated. Screen-specific workbench/customer APIs and price-edit APIs are additionally gated; shared cross-module lookups retain native domain guards.

Customer and Master Data update prechecks now use positive access controls, not only legacy deny tokens. Private snapshot roles cannot be assigned to another user or edited through the old role-assignment form. Last-effective-manager protection covers read/manage/page grants. Current sessions re-read permissions on each request. Unknown registered native permissions are retained during migration and can be explicitly unchecked; shared memberships and inactive grants remain intact.

Agency passenger detail access is bounded by active agency membership, its branch, Customer-owned organizational buyer references and Sales-owned contract/passenger references. Persian/Latin first/last names and display name are immutable. Editable identity fields: birth date, national ID, passport number/expiry, gender, nationality, issuing country and birth country. The request uses the user's SSR-as-passenger-detail terminology; this does not introduce an airline special-service request approval/fulfilment workflow. Passenger accounts are not created. New portal read/update permissions start ungranted. Existing six portal sections are mapped from B2B membership sections.

Producer/consumer compatibility: IAM snapshot/catalog -> AuthGuard and domain guards, Customers/Master Data field checks, B2B portal, Web. The bounded Customer/Sales public projections return only organizational IDs and contract/passenger references to B2B, never cross-module direct table access from B2B. Reserve these additive public boundaries, B2B portal wiring and the three generated English-catalogue files for task-only additions. No accounting code, schema, migration or dependency change.

Validation evidence (local ignored logs): full API suite before final refinements 2364 passed / 304 skipped; final focused authorization/domain suite 129 passed; final agency suite 12 passed, including successful bounded identity editing; fresh isolated PostgreSQL suite 4 passed, including registered extension-permission revocation and last-manager read/page protection. API/Web typechecks, scoped lint and affected production builds passed. Final Web catalogue/editor/organization checks are recorded below. Browser on isolated ports4108/4109 confirmed the 24 sections and unchecked-permission persistence on a synthetic account. Real HTTP with the SAME synthetic staff session: checked customers.read=200, unchecked=403, stale admin save=409, rechecked=200. No real user was changed for testing.

Operational status: read-only preview of the existing nora database identified15 users. Preview and account-grant snapshots are under ignored tmp/iam-v3, never Git. No live migration has run. Both native4000/Web3000 and Compose4192/Web3100 share nora; all active APIs must run this authorization model before conversion. The CLI requires matching /iam/access-version responses from every supplied runtime URL, a fresh fingerprint and a writable exclusive receipt; conversion is serializable, all-or-nothing and idempotent. Do not run an old runtime against converted accounts: old readers could reintroduce shared-role grants. Rollout requires the repository's explicit merge/deployment authorization; do not merge automatically.

## Deployment handoff

1. Obtain explicit merge/deployment approval and require successful CI for the reviewed revision. Preserve concurrent project changes; deploy the integrated revision to every active API sharing nora, including native4000 and Compose4192, and their Web clients.
2. Take a verified database backup and preserve the ignored before-grant preview. Verify the local target and all runtime URLs. Do not place account grants or credentials in Git.
3. With DATABASE_URL supplied by the existing trusted local configuration, run the preview command from the repository root. Use a new filename each time.

```powershell
pnpm --filter @nora/api exec tsx scripts/migrate-manual-access-v3.ts --preview ../../tmp/iam-v3/before-rollout.json --expected-database nora
```

4. Review the preview, then apply the already-authorized legacy mapping. Both runtime endpoints must report the matching manual-access version and catalogue. Include any additional active API sharing this database.

```powershell
pnpm --filter @nora/api exec tsx scripts/migrate-manual-access-v3.ts --apply ../../tmp/iam-v3/before-rollout.json --expected-database nora --receipt ../../tmp/iam-v3/rollout-receipt.json --runtime-url http://localhost:4000/api/v1 --runtime-url http://localhost:4192/api/v1
```

5. Confirm the receipt, run an after-preview and compare each user selection, verify both new agency passenger permissions remain absent, and smoke-test authorized/denied operations. Record actual converted/unchanged counts here. A stale preview requires a fresh review, never bypassing the fingerprint. Do not start an old API against converted accounts. Rollback requires coordinated runtime and grant restoration from the before snapshot; disabling a snapshot role alone deliberately fails closed.

Fresh live preview on 2026-10-12:15 users,0 already converted,0 new passenger-read grants,0 new passenger-update grants. Receipt absent: live conversion has NOT occurred.

Final Web organization/editor run:263 passed and1 skipped, plus2 catalogue assertions passed and1 timed out under parallel machine load. The unchanged catalogue suite rerun alone passed all3 assertions. CI found an old blanket administrator-screen assertion that needed to include the new purchasing checkbox's existing native-grant requirement; its replacement explicitly verifies both denied-without-grant and allowed-with-grant cases. CI also found formatting in the added agency test; corrected. These do not alter runtime behavior.
