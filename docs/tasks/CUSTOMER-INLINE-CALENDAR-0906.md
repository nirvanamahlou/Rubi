# CUSTOMER-INLINE-CALENDAR-0906

- COMPUTER_ID: PC-A
- Branch: codex/pc-a-customer-inline-calendar-0906
- Base: fc9177b (previous verified local integration).
- Scope: Customers entry-sheet and date-field, shared by Sales; no API/schema/migration, grants, dependency changes, other producer worktrees or public publication.

## Request and implementation

The date cell opened an intermediate centered Dialog, which then opened a calendar inside it. Replace that two-step interaction with the existing themed calendar directly anchored to the table cell. Both birth date and passport expiry use the compact variant. Calendar switching moves inside the popup; the closed table contains only the date trigger, retaining its row-specific accessible name.

Use the browser non-modal top layer for the compact calendar: no additional backdrop, navigation or modal. Content stays in the existing form's DOM/focus scope, escapes the horizontal table clipping and transformed dialog, and repositions within the viewport on resize/scroll/content resize. ISO values and Persian/Gregorian calculations stay unchanged. Capture Escape before the containing dialog receives it, returning focus to the trigger. Selection and clearing update only the corresponding row/field. Existing read-only/opt-in editable fields and save disabling are preserved.

## Verification

- Scoped lint and Web typecheck passed.
- 222 Customers/Sales/calendar tests passed, including three new structural regression tests.
- Headless Chromium with actual components in a synthetic customer Dialog passed: one direct non-modal popup; table clipping; Persian/Gregorian switch; year/month/date selection and exact ISO result; Escape retaining the parent form; outside-click dismissal; independent passport-expiry clearing; focus return; desktop/mobile viewport bounds. No authenticated user data or real record creation.
- Production build passed (36 routes). Web3100 restarted with the new output; final-CSS interactive checks passed again. Login and API health return 200; Customers requires authentication (307). API4000 was not restarted. Prior web output is retained at tmp/inline-calendar-web-before-0906. No authenticated browser walkthrough is claimed.
- Synthetic fixture, QA screenshots and retained prior web build are ignored under tmp/.
- PDF output and the separate unresolved agency-commission treatment are not changed by this calendar task.
