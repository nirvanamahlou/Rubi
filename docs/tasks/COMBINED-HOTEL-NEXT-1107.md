# Combined hotel pricing navigation

User authorizes correcting the disabled first-step pricing navigation after adding additional hotels, and merging to develop after successful checks.

Root cause: automatic checkout for the primary hotel was derived from the return trip date, while additional stays require chronological, non-overlapping dates. Entering a second stay inside the trip therefore failed a boolean guard without a visible reason. The primary automatic checkout now derives from the first additional check-in. Existing provenance preserves manual/legacy entered dates; conflicting manual dates display a correction message. No dates in stored contracts are rewritten.

The shared hotel validation error preserves every previous rejection and provides the parent form with the same decision and explanation. Pricing, contracts/API, room/guest normalization, optional journeys, permissions and backend validation are unchanged. Six additive English translations cover the new messages. No schema/migration/dependency or production release.

Regression coverage includes automatic splitting and changed boundaries, preserved manual checkout, invalid or missing hotel/room dates and references, payload stay dates, and the rendered navigation button for hotel-only and flight+hotel. See PROJECT_STATUS for final validation and CI receipt.

Closeout: PR1470 final source dd4e8e92e859f4c3122a1324ed66e8a9dc9bd77f passed all 8 exact-head push/PR checks and merged into develop as e3ca5977c075aee6699a83dca49b44e155c2866c. Local Sales suite788 passed, one existing skip; final focused parent/model31 and translation44 passed. Scoped ESLint, standalone Web TypeScript and production Web build (Webpack,67 routes) passed; local Turbopack rejects cross-worktree dependency junctions, while hosted standard production builds both passed. Same-day previous checkout/next check-in is explicitly accepted and tested. Source reservations released; no migration or server deployment. Completion-only handoff is pushed on the closed task branch.
