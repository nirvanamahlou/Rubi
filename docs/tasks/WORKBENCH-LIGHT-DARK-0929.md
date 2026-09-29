# Workbench entry and light/dark readability — 2026-09-29

COMPUTER_ID=PC-A. Branch `codex/pc-a-workbench-light-dark-0929`; owner explicitly requested implementation, merge to develop and local activation.

## Behavior

- `/` and successful login without an explicit internal destination open `/workbench`. Brand/home links follow Workbench. Dashboard remains reachable with its existing access checks. Valid requested internal deep links are retained; external, protocol-relative and backslash/control-character destinations fall back to Workbench.
- A fresh browser defaults to light regardless of OS preference. Successful login resets to light. A user's manual dark choice survives page refresh during their session. Theme initialization updates the DOM even when the resolved theme equals the initial light state; blocked localStorage does not prevent switching.
- Existing semantic dark surfaces and component-authored dark variants stay in force. Legacy light utility panels/text/gradient stops receive bounded screen-only dark fallback colors. Rules stay in the utilities layer so hover/focus states remain functional. Intentionally dark labels on the light primary button are retained.
- Fixed blue/violet Workbench headers now use white text throughout the gradient, rather than dark primary foreground inherited from the dark theme. IAM selected-user/access/recommendation panels and remaining System controls use shared semantic colors.
- Corporate workspace legacy ink/light panels adapt using light-dark colors and shared dark tokens. Its local muted text variable no longer shadows the global surface token. Status/accent links remain visible; business queries, access and actions are unchanged.

## Validation and limits

250 targeted Web tests pass, including default/deep-link destination, explicit theme preference and numerical contrast checks for all nineteen fallback color families and the full banner gradient. Full Web lint, typecheck and production build are required before merge, followed by official CI. The local fixture compiles the actual app CSS; browser attachment failed, so authenticated visual QA is not claimed. No migration, dependency/lockfile, API, permission grant or operational record change. Original dirty checkout and other computers' work remain intact.
