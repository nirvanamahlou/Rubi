# HR-RADAN-LIVE-1101

COMPUTER_ID=PC-B. Owner requests local3100 activation for Niyayesh Seir Sahar; Radan is read-only. Source branch `codex/pc-b-hr-radan-live-1101`.

## Implemented boundary

- HR-owned server-only Radan client: login, zero-based bounded Users/Clockings pagination, total/duplicate validation, single token refresh, no redirects or upstream writes. Credentials and origin are deployment environment only.
- Authenticated `POST /hr/attendance/device/sync` and scoped `GET /hr/attendance/device/status`, both require hr.manage and configured native branch. Clock-aligned Tehran API lifecycle polling reauthenticates a native IAM session through its public contract; it stops writing when that session or branch permission is invalid. No grant changes or assumed system identity.
- Exact normalized personnel-code mapping within the configured native branch. Leading zeros preserved; ambiguous normalized codes fail closed. Provider IDs yield deterministic source-scoped UUIDs; repeat pulls cannot duplicate punches. Deleted punches and closed original/corrected dates remain protected. One redacted batch audit; no full provider profiles stored.
- Initial/repeated synchronization covers the last32 Gregorian calendar dates including today. Unknown codes, invalid/future dates and rejected/non-normal source records are excluded or reconciled without inventing employee identity. Source pagination currently has no verified date filter, so it reads a bounded complete source list before selecting the window.
- Explicit in/out directions are authoritative. Neutral attendance announcements alternate chronologically within an assigned shift window, with exact duplicates suppressed; raw neutral provenance retained. Approved manual corrections replace original device events. A single/open punch never invents an exit or final deficit/overtime.
- Assigned shifts take precedence. With no assignment, one active native-branch working-hours definition supplies the schedule; multiple definitions require an explicit assigned shift. Iran-local input becomes UTC through existing timezone conversion. Lateness and early departure are nonnegative minutes; actual worked intervals after scheduled end count as overtime independently of late arrival. Deficit counts uncovered scheduled minutes including internal breaks; configured approved interval credits reduce deficit.
- Existing daily calculation stores UTC firstIn/lastOut and minute metrics; unchanged recalculations do not create new versions or notifications. Device-only processing does not create unsupported absent days for employees without punches.
- Employee dossier retains five requested columns. Time attendance exposes personnel code, employee, date, entry, exit, late, early departure, overtime; newest effective date first,20 rows/page. Exports use the same projection. Workbench reads own HR-linked employee only and exposes measured deficit alongside existing late/overtime and today's punches. Unknown measurements remain null. Visible HR/performance pages refresh every minute.

## Configuration and operation

Set private environment values `HR_RADAN_ENABLED`, `HR_RADAN_BASE_URL`, `HR_RADAN_USERNAME`, `HR_RADAN_PASSWORD`, `HR_RADAN_BRANCH_ID`, `HR_RADAN_ACTOR_ID`, `HR_RADAN_SESSION_ID`. Do not commit their values. The actor must be an existing authorized native HR manager. Scheduled sync resolves a currently valid session of that same configured account on each tick; HR_RADAN_SESSION_ID is retained only for compatibility with older releases. A manual authorized sync does not depend on the polling session.

The owner-approved workstation bridge supplies local port3333 and the read-only company API. The PC must remain running and connected. No Windows startup persistence was added in this task. No schema/migration/dependency change or production application deployment.

## Local data and verification

A private local database backup precedes setup. Twelve real personnel profiles already registered in Nora match source codes exactly and were prepared in the local Niyayesh branch through the native HR command. Existing demo employees remain unchanged. No account links guessed or IAM users/grants created. Local working hours were absent, so the exact owner-specified09:15–17:00 definition was created in that branch through HR.

Live native API verification: source18 users /7179 clockings;72 matched recent punches,43 daily rows over5 source days,27 with an exit,14 with positive lateness,8 with positive overtime. One recent punch has an unmatched personnel code. Repeat pull imports0, reports72 unchanged, and preserves total115 punch/daily rows. Incomplete source days display no fabricated exit. Workbench requires its existing employee-to-IAM account link; local demo identities were not reassigned to real staff.

API runtime retains the previously active General Ledger build and overlays only the tested HR compiled module. Web uses this task's isolated production build. Credentials, backups, runtime files and real employee reference data are ignored under tmp, never staged.

Validation:42 API tests across six files;9 Web projection/card/translation tests; API/Web scoped lint; Web typecheck; API production TypeScript build. Final builds/local3100 HTTP acceptance and exact final counts are recorded below once completed.

## Final local acceptance

API and production Web builds pass. Web production server is listening on3100; authenticated HR time, employee list and own performance routes each return HTTP200 without a login redirect. Real API health and scoped sync status pass; repeat sync remains0 imported /72 unchanged,115 total rows. Final normalized-code and zero-buffer overtime regressions pass. All42 targeted API tests and9 Web projection/card/catalog checks pass, with scoped API/Web lint and Web typecheck. No visual-browser acceptance claimed: browser automation initialization fails with Windows os error3. The current local administrator has no HR-linked real employee, so own cards require the normal explicit employee account association; no identity is inferred.

Calculation reads source punches only in the bounded date window required for two-day shifts and read buffers, so retained historical punches do not eventually exhaust the10000-row source limit. Native row selection/export actions remain available alongside the eight business columns.

## Owner-requested synchronization schedule

Automatic reads run at09:00,09:15,09:30,09:45,10:00 and17:00,17:15,17:30,17:45,18:00 in Asia/Tehran; all other reads run at each full hour. A strict-future one-shot timer avoids off-slot startup requests and two-minute error retries. After a long pull or failure, select the next future clock slot instead of issuing catch-up bursts. Shutdown clears the timer and prevents rescheduling. Explicit manual sync is unchanged. Scoped status reports the UTC nextSyncAt and timeZone. Sixteen focused schedule/authorization/lifecycle checks pass, including clock boundaries and failure/shutdown behavior. No UI/schema/dependency change. Owner explicitly authorizes push and develop merge after exact-head hosted gates.


### Attendance session refresh repair — 2026-11-07

Scheduled sync resolves a currently ACTIVE, unexpired native session of HR_RADAN_ACTOR_ID through the dedicated internal IAM method on each tick. HR_RADAN_SESSION_ID is no longer pinned by scheduled attendance. Current active-user status, HR management grant and intersection with configured source branches are rechecked; no browser session, role or grant is created. If all sessions expire or are revoked, synchronization remains denied until that configured account logs in again; the next scheduled tick resumes without an API restart. Manual scoped sync is unchanged. Existing hourly/09:00 and17:00 quarter-hour schedule is unchanged. Production diagnosis read only: pinned ROTATED family had no live session while the same configured user had live sessions in newer families; no device or personnel data exported.


### Fast current-day synchronization � 2026-11-08

Supersedes the earlier sparse schedule at the owner's request. Schedule the next minute boundary after completion (no overlapping pulls or catch-up burst). Startup/manual and successful hourly reconciliation retain the complete bounded source reader and historical corrections. In between, read newest-first clockings through yesterday/today's normalized window, applying each source date offset exactly once when deriving the raw boundary. Validate observed ordering; incompatible timestamps/order fall back to the full reader. Both live providers returned descending first pages; primary page 0 crossed into 2025 while secondary contained all49 records. No unsupported API date parameter or bridge permission expansion. Credentials and employee allowlists remain unchanged. Typical latency is up to one minute plus provider/calculation/UI refresh, not a push guarantee; device-to-Radan delays and workstation availability still apply.

Owner confirms primary Radan date has been corrected. Optional server-only HR_RADAN_DATE_CORRECTED_FROM is a raw YYYY-MM-DD cutover: dates at/after it receive zero offset, older dates retain +1. Deployment cutover2026-11-08 preserves historical normalization while accepting today's real punches. Secondary policy is unchanged.
