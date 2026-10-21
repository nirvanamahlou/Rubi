# FIVE-BRANCH-COMPANY-1019

## Owner scope

The owner explicitly confirmed that every current account should receive all five branch scopes: HQ, Niyayesh Seir Sahar, Jahan Bastan, Ghesati Ro and Jahan Academy. Operation/screen/field permissions, roles and account status do not change. Owner requests push only, not merge or production deployment.

## Implementation

- Data-only migration `20261019110000_five_company_branches`: atomic transaction, real branch records, reuse canonical IDs and uniquely matching legacy-name IDs; fail on ambiguous duplicate names instead of guessing. Reactivate the five requested branches without renaming existing canonical records.
- Add only missing user/branch memberships, including inactive accounts without activating them. Preserve existing primary flags and all extra memberships. New HQ membership is primary only where no prior primary exists. System audit events identify exactly the added branch IDs; no fictitious human actor.
- Ensure four real issuer companies exist and are active. Existing official names, identity fields, branding versions and issued-document snapshots remain intact; inactive issuer activation increments the normal entity version only. No invented legal IDs, logos, signatures or letterheads.
- All existing session-backed branch selectors receive the same actual saved memberships; no per-screen hardcoded fake options or bypass of branch validation.
- Company context UI now includes active Jahan Academy. Aggregate company mode still requires the existing administrator permission and is not a substitute for HQ.
- New-user form defaults to the actual five branch IDs obtained from access options. Empty loading responses never manufacture IDs. Explicit deselection is preserved; editing existing users retains their saved memberships. This is a new-user UI default, not a login-time automatic regrant or override of later administrator choices.
- Fresh fixture seeding receives existing company branch memberships, without changing its original HQ primary.

## Verification

139 focused Web tests pass. Web and Database types and scoped lint are checked. Real PostgreSQL test runs under the existing `IAM_USER_UNIT_TEST=1` isolated CI job, using temporary tables that shadow permanent names. It tests all-user scope backfill, extra/primary-scope retention, legacy ID reuse, official-name/branding retention, four issuers, audit evidence and repeat execution without duplicate grants/audits. Local Docker daemon did not respond, so no local database test success is asserted.

## Release and recovery

1. Review and back up the intended database, especially branches, user memberships and issuer metadata. Merge/deploy requires separate authorization.
2. Apply normal Prisma migrations before the matching Web build. This upgrade has no schema/dependency change, but intentionally broadens all existing accounts to five branches by owner approval.
3. Refresh session context/reload the browser. Existing stored operational rows remain in their original branches; no sales/accounting/customer record is reassigned.
4. Rollback is operator-reviewed, not an automatic delete of branches/issuers. Audit action `iam.branches.owner-approved-backfill`, metadata source `FIVE-BRANCH-COMPANY-1019`, records added IDs. Revoke only those memberships that still have `grantedAt` equal to that audit's `occurredAt`; later administrator reassignments must be preserved. Restore any previous activation/code metadata from the pre-deploy backup when required. Never delete branch/issuer records that may now be referenced by operational data. Reverting Web alone cannot undo the intentionally saved access expansion.

No operational server, live account or production database was changed while implementing/testing this task.
