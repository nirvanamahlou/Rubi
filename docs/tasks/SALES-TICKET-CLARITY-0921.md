# SALES-TICKET-CLARITY-0921

PC-A; isolated branch from origin/develop@5f66ef97. Presentation-only redesign requested by the owner.

Airline and route names are prominent, departure/arrival dates remain fully visible (including overnight arrivals), and times use the existing Asia/Tehran formatter. A restrained selected border replaces the saturated full-card fill. Existing capacity and standalone fare eligibility, offer identity and selection callbacks are unchanged.

Overlap audit: the old reservation UI worktree's changes to the ticket card/picker only rename @nora/contracts to @rubi/contracts. The current develop package namespace is @nora; the stale rename was not imported. No old worktree was modified. No API, migration, lockfile or localhost:3100 changes.

Review against develop; do not auto-merge. Finance inbox changes are delivered separately.

Validation: 7 focused card tests (including overnight dates, capacity and standalone fare guards), scoped ESLint, Web TypeScript and production build (50 pages) passed. Browser visual verification was not performed. Local contracts declarations were built before the final successful build; no dependency changes.
