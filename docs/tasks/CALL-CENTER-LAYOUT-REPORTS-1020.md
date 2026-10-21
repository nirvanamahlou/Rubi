# Call Center layout and report refinements — 2026-10-20

Owner request: reference-image placement/proportions, larger panel text, source donut with colored legend, most-followed contacts and operator performance. Explicit approval is scoped to this UI change under CALL-CENTER-UI-PRESERVATION.md.

## Layout

On wide screens the dossier is on the right (22%, minimum250px), and contacts plus reports occupy the left remainder. Closing the dossier restores the full-width list. Existing tablet/mobile overlay and labeled contact records are retained. Main table/control text increases from12 to14px; helper text from11 to12px. Shared ERP shell is unaffected.

## Report definitions

- Sources: counts and percentages use the existing authorized matched call report. The donut and colored legend display the same values, duplicate displayed labels are consolidated, and empty data remains explicit.
- Most follow-ups: five contacts with most **registered outbound calls** matching the report interval and call filters. This is not a count of Tasks or proof of an answered conversation. Rank ties use stable contact ID. SQL aggregates the entire authorized dataset before LIMIT5 and resolves only five encrypted call summaries. Synthetic calls are excluded by the existing report predicate.
- Operator performance: manual registrations in the filtered interval, actions completed in the interval by their recorded historical actor, and current open responsibility in the branch. These are separate columns; no unsupported phone response rate or invented percentage is displayed. Unknown or inactive directory identities have an explicit fallback.

The additive topFollowUps response field is optional in the Web reader for compatibility with an older API. Its unavailable state is different from an empty successful ranking. No schema, migration, account-grant, dependency or financial change.

## Validation

Existing plus ranking PostgreSQL/HTTP checks36 pass. Web report/transport/model checks17 pass. Isolated Chrome155/Edge155 fixture checks confirm a narrow right dossier, wide left list, search race protection, dialog Escape/focus return and mobile390px without horizontal overflow. Synthetic fixture data is not operational or Provider evidence. Final build/lint and local runtime details are recorded in WORK_ASSIGNMENTS.md and PROJECT_STATUS.md.

Final API/Web lint and optimized builds/typechecks pass. The final local API rerun uses a command-only20s test deadline: retained disposable fixtures caused the existing global reminder scan to exceed5s under load, followed by a dependent version conflict. All36 unchanged assertions pass with the local deadline; repository and CI settings are unchanged. Final Chrome/Edge checks also cover resizing with an already-open dossier. Web3000 build DYw1CLzImaCWcvR8th0Zf and API4000 health return200.
