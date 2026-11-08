# Insurance correction — 2026-11-08

PC-A; codex/pc-a-insurance-correction-1108; base develop53cc0a538.

The Reservations insurance document summary and policy management table now offer correction for DRAFT, INPUT_ERROR and PROVIDER_ERROR requests. The existing policy-management permission guard is retained. Automatic policies open a shared correction dialog with required-data guidance and the existing Customers deep link for precisely that customerId, in a separate tab. Customers retains its own read/edit authorization and audited persistence. Manual policies retain the existing versioned draft editor and now include the same guide. Issued/cancelled policies are never locally amended.

Required fields are derived from Customers CustomerInsuranceIdentity.read: Persian names, passport Latin names, actual birth date, M/F gender, nationality, passport number, Iranian national ID, mobile and email. Existing contact fallback is passenger first, then contract customer. The guide asks for exact passport spelling, Latin characters/digits, preserved national-ID leading zeros and the correct date-picker calendar, plus assigned INSURANCE and configured destination/plan/travel date/duration. These are input guidance, not invented provider regex rules.

The existing worker retries incomplete automatic policies after nextAttemptAt (60 seconds after a failure). No new retry endpoint, provider operation, sensitive-data query, credential, schema or dependency change is introduced. Existing submitted-input fingerprints continue to prevent blind resubmission; changing a customer record does not amend an issued policy. The connection remains Travis sandbox-only, without real travel coverage.

Sources: docs/tasks/AUTOMATIC-SANDBOX-INSURANCE-1107.md; INSURANCE-WORKSPACE-1025.md; TRAVIS-SANDBOX-CONNECTION-1031.md; apps/api/src/customers/customer-insurance-identity.ts; apps/api/src/reservations/insurance/insurance-automation.ts. User explicitly authorizes develop merge after final-head checks; no production deployment requested.

Validation: 56 focused Web/Customer regression checks passed. Initial test attempt lacked built contracts; subsequent focused run passed after contracts compilation. Formatting and offline catalogue generation completed. Type/lint/build verification was in progress when final fetch revealed overlapping active PR1507 on codex/insurance-amend-1108. Source integration is stopped pending owner coordination as required by AGENTS.md. This local candidate has not been merged or deployed.
