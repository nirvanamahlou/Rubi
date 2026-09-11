# WORKBENCH-032 — Calendar event form and Workbench UI polish

## Scope

- Replace the Notes date-filter placeholders with the compact Persian labels requested in Screenshot 562.
- Add a calendar event dialog with a required title/date and optional text, safe HTTP(S) link and image attachment.
- Remove the profile appearance/theme card so the shared Rubi header remains the only theme control.
- Refresh the messenger with Rubi gradients, colorful unit/template surfaces and remove visible inactive/unavailable copy from the messenger and new-message dialog.

## Behavior and boundaries

- A created calendar event appears immediately in the selected Persian calendar day and its detail list. Optional text, link, image name and image preview are rendered.
- Links are accepted only for `http` and `https`. Images are limited to image MIME types and 5 MB.
- Image object URLs are revoked when the calendar unmounts.
- Calendar entries are session-local because no Workbench event persistence contract exists. Message sending remains disabled because no delivery contract is available. No API, database, migration or dependency changed.

## Verification

- `pnpm --filter @rubi/web exec vitest run src/modules/workbench src/modules/profile` — 56 tests passed.
- Scoped ESLint for Workbench and Profile passed with zero warnings.
- `pnpm --filter @rubi/web typecheck` passed.
- `pnpm --filter @rubi/web build` passed with 46 routes.
- Authenticated browser QA on `localhost:3100` verified compact Notes dates, absence of the profile theme card, the colorful messenger without inactive/unavailable text, and calendar event creation with text, `https` link and a PNG image. The created item appeared on the current day with its link and image. Browser console had no warnings or errors.
- Web runtime: source `623fbb0`, PID `14168`, build `GhIUre85BIXBxND2PRsp2`. API4190 remained PID `15024` and was not restarted.
