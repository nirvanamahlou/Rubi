# Call Center advanced filter calendars — 2026-10-25

CALL-FILTER-CALENDAR-1025 / PC-C, based on approved local0fad730e.

Both date filters now use an uncontrolled Persian-default calendar, allowing the existing calendar switch to work. Previously calendarSystem="gregorian" forced the state back without a change handler. Reuse the existing calendar conversion, month/year grids and viewport-aware portal; no parallel calendar library.

The opt-in filterCalendar presentation adds navy styling, Gregorian English month/weekday labels, chronological month/year tiles, Clear and Close footer with focus return. Other date picker consumers retain their behavior. Dates remain ISO calendar days in state and become Tehran-midnight UTC timestamps in searchBody. The upper bound remains explicitly exclusive (until start of selected day), preserving the API/report contract. Persian/Gregorian switching changes presentation only.

No schema, migration, dependency, API, PBX, popup, permissions or operational data changes. Preserve approved queue/contact columns and all unrelated panel sections. No PR/merge/production deployment.

Validation:18 tests pass (calendar conversion/navigation/positioning and search request serialization), scoped lint, TypeScript and65-route production build pass. Authenticated browser: Persian day selection reduced12 contacts to4; Gregorian switch/month grid and independent end-date selection/clear pass; Persian year/month grids, Close and Escape pass. Screenshot kept outside Git. Web3000 PID4392 runs .next-filter-calendar-1025 with popup feature false; API/Worker unchanged. No migration.
