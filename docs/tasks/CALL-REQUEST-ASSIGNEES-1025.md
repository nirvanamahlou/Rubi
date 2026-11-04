# Call Center request assignee directory — 2026-10-25

Work: CALL-REQUEST-ASSIGNEES-1025, PC-C. User explicitly approved self-only ordinary agents, own-unit managers, and named executive/demo accounts across units. Personnel identities are private deployment data and are not committed.

## Contract and authorization

GET /api/v1/customer-affairs/call-center/request-operators uses the existing authenticated actor, workflow permission and branch authorization. Ordinary accounts (including legacy broad accounts) receive only themselves. Managers use the existing customer_affairs.call_center.workflow.manage.team permission plus a current active IAM organizationUnitId in the request branch. The exact unit UUID is used; same-named units in different companies never match by text. Missing/inactive/foreign-branch units fail closed to self.

CALL_CENTER_REQUEST_GLOBAL_USERNAMES is a private server environment comma-separated allowlist for the two explicitly approved accounts. Default empty. Identity comes from the current active database account, never a browser username or display label. It expands request-assignee selection across units, not the actor's branch access, contact visibility, PBX privileges, or other ERP grants. Preserve all existing scope checks. No new account is created.

Recipients must be active native ERP accounts belonging to the authorized request branch. The HR public directory supplies only linked active employee full name and current job title; account displayName is fallback and absent titles display explicitly as unknown. Employees without accounts cannot be selected. Existing telephony/operator/referral directories remain unchanged. Request owners need appropriate existing screen/workflow access to work on a request; selecting a recipient does not grant access automatically.

The save path revalidates every new or changed recipient under shared account/profile/branch locks. Historical unchanged owners remain retainable so unrelated edits do not erase historical attribution. Existing nullable historical assignments remain compatible. Idempotency, CAS, request audit, notifications and transaction rollback stay in place.

## UI

The existing OwnerSelect is retained. Only request editing uses the new directory; task/referral options remain on their original contract. Full name for self/team, full name plus position for configured global users. One available recipient auto-selects for a new form. Loading and failed-read/retry states prevent submission against an unavailable directory. A branch/retry key and effect cleanup discard out-of-order responses. Existing owners absent from today's list keep the existing historical-owner label. No layout or global popup change.

## Local data and activation

Read-only inspection found no linked active HR staff, no IAM unit membership, and neither configured executive account in this local database. Therefore complete staff/name/title/manager demonstrations require the real ERP account and HR associations to be populated through their owning modules. No names, unit memberships, accounts or grants are guessed or created by this work. Private local environment contains the owner-approved allowlist; it must be carried separately to an authorized server rollout.

No migration or dependency/lockfile change. No production deployment, PR or merge authorized. Runtime and final verification evidence are recorded in PROJECT_STATUS.md.
