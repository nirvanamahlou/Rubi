# CALL-CENTER-FILTERS-STATUS-1031

PC-C, base40916ebe1, user explicitly authorizes this UI revision.

Removed branch selector, latest/history selector and registration-origin selector. Internal default LATEST and server-enforced branch scope remain; this is not a cross-company data aggregation or permission grant. Calls still use an authorized branch context. Source filter uses the same canonical sources as CallForm with a sufficient option limit; unit filter now uses the same destination-options endpoint/labels as CallForm instead of obsolete static examples. Matching remains the existing encrypted source/unit search-token predicate.

Existing request edits: unchanged title/assignee/priority remain manager-only. Experts may switch an open request between IN_PROGRESS and WAITING_CUSTOMER; closing or reopening requires the existing IAM public canManageRequest capability for the responsible person's current unit. Existing actor/contact/request scopes, CAS, idempotency, closure result and pending-task guards remain. Creation remains IN_PROGRESS. Existing configured global administrative policy stays authoritative.

Verification:19 focused Web tests passed; final5 editor tests pass including expert state control, protected management fields and closed request lock vs manager reopening.8 API input tests pass;19 PostgreSQL tests skipped without isolated test DB, including the extended forged-close and permitted waiting-state regression. Scoped Web/API ESLint and formatting pass. Full Web types fail against reused older compiled Contracts artifacts; full Next build fails because Turbopack rejects external dependency junctions. API typecheck also requires synchronized generated dependencies. Offline frozen installation reported supply-chain policy failure and was stopped, never bypassed or lockfile changed. No full-build or database authorization success claimed.

No migrations, dependency declarations, secrets, live DB/PBX changes or production activation. Active recording-download work remains separate. Clean dependency install, current Contracts/Prisma generation, full build and isolated PostgreSQL authorization checks are required before release.
