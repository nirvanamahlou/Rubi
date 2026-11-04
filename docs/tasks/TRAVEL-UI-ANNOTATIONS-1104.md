# TRAVEL-UI-ANNOTATIONS-1104

Owner requests nine annotated UI changes and push/develop merge. PC-B, branch codex/pc-b-travel-ui-annotations-1104 from a569718d6.

- Remove the purchase-hub supplier-management card; the actual supplier directory and route policies remain unchanged.
- Compact all six service categories into one nonwrapping row; use horizontal scrolling where the viewport cannot fit their minimum usable widths.
- Remove the ticket definition eyebrow.
- Put visible city and pack labels above the saved-package comboboxes. React-generated IDs associate each label with its input while existing descriptive accessible names and navigation guards stay compatible.
- Move Reservations Excel export beside Refresh, preserving the same filtered export payload, readiness checks, filename, busy state and independent error message.
- Remove the specified hotel profitability explanation, hotel/transfer submission helper and shared floating-flight purchase helper (both outbound and inbound instances).

No API, schema, calculation, dependency, permissions or operational data changes. No production deployment requested in this unit. The existing supplier-card assertion now reflects its removal; the existing saved-pack interaction harness supplies useId. All78 focused checks pass across the affected run and three-test rerun; scoped ESLint passes. Full Web TypeScript and final-head hosted quality/tests/migration/build gates must pass before the authorized merge.
