# SALES-PEOPLE-RECOVERY-0907

PC-A; base b69511c; codex/pc-a-sales-customer-pricing-0907. COMPLETE_LOCAL.

## Cause

Every create/contact exception previously marked a row reviewRequired, including definitive validation/permission rejections. The next save rejected reviewRequired before any recovery. A contact failure could therefore trap an already-created person, and successful phone registration was not checkpointed before a later email failure.

## Changes / compatibility

- Known non-committing HTTP 400/401/403/404/413/415/422/429 rejections remain correctable without a persistent review lock.
- Network/5xx/409 outcomes remain guarded, but confirmation now performs recovery first. Known customer IDs load current authorized detail and reconcile pending edits against the saved version. Completed contacts are not repeated.
- Unknown person creation uses the additive public Customers POST /api/v1/customers/registration-lookup endpoint. The request carries national ID, first/last name and optional birth date in the body, not the URL. Exact fingerprint lookup is scoped to actor branches, active unmerged people; returned identity must match supplied names and birth date.
- Read and sensitive-read permissions are required; successful sensitive detail recovery is audited with customer-verification reason. No permission bypass/grant, raw identity logs, cross-module table query or new persistence.
- A no-match lookup permits retry with the same national ID; the existing database unique fingerprint prevents a raced duplicate. Changing national ID after an uncertain create remains guarded. Failed/mismatched/out-of-scope recovery never triggers blind creation.
- Successful identity and each contact checkpoint are retained. The UI offers “بررسی و ادامه ثبت افراد” instead of requiring manual reselection for every error.
- Old API clients and public types remain compatible; new request/endpoint is additive. Producer Customers and consumer Sales are both PC-A. Pending identity values remain in existing in-memory draft only, not localStorage.

## Verification

- 243 combined Sales/Customers Web tests, then final 8 customer-client tests (including new body-only lookup).
- 91 Customers API tests, then final 16 controller permission tests; 48 Contracts tests.
- New tests exercise definite rejection retry, committed create/lost response, no-record recovery, denied recovery, changed national ID guard, successful phone/failed email, and committed contact/lost response.
- Repository/service tests assert branch fingerprint scope, identity mismatch rejection, read/sensitive-read enforcement and sensitive audit.
- Scoped ESLint, API/Web TypeScript and production builds passed. No schema, migration, seed or IAM changes.
- Local Web3100/API4000 updated. Prior Web build retained at ignored tmp/people-recovery-web-before-0907. No authenticated real-customer mutation or browser walkthrough performed.
- Local commits only; no public push/merge. Task-specific contract and central-doc reservations released.

## Operator note

The older open page must load the new bundle to use recovery. Unsaved people details are intentionally held only in memory: retain unsaved entries before refreshing. Stored customer records are not deleted by a form refresh.
