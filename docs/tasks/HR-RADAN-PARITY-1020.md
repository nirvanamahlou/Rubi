# HR-RADAN-PARITY-1020

Status: PARTIAL_READY_FOR_CI — bounded implementation candidate; not full Radan parity.
Owner: PC-B. Base: origin/develop@fc221adc. Branch: codex/pc-b-hr-radan-parity-1020.
Human authorizes push and develop merge after verification; design must stay unchanged.

## Evidence and counting boundary

Source is the operator-authorized UI inspection of Radan at 192.168.8.15 on 2026-10-20. The first-pass inventory is a local artifact outside Git. REA's second pass only reached /login and provides no authenticated feature evidence. No proprietary bundle, customer data or credential is committed.

The checklist below counts 23 functional areas, not individual controls or equivalent algorithms. Before changes: 9 present, 8 partial/different, 6 absent. Presence does not establish computational equivalence. Locked Radan modules and names discovered only in script resources are excluded.

| Area | Nora before | Candidate and remaining difference |
| --- | --- | --- |
| Employee record | Partial | Existing form preserved; Radan identity, education, military and contact fields still need a privacy-aware persistence slice. |
| Organization chart | Present | Existing organization hierarchy and design retained. |
| Employee groups | Absent | Group definition and employee membership added using actual employee/parent FKs; group filters in employees and reports. |
| Roles and assignment | Present | IAM remains the canonical owner; no duplicate HR permission store. |
| Attendance calculation settings | Absent | Not implemented in this candidate; do not pretend field labels establish all engine semantics. |
| Devices | Partial | Host/IP, port, device type and description appended without moving legacy columns; network credential storage/actual hardware sync not implemented. |
| Clocking | Present | Existing canonical clocking commands retained; list sorting added. |
| Attendance correction | Present | Existing authorization, approval, UTC and period safeguards retained. |
| Working hours | Absent | Separate definition with start/end, same/next/two-day end, attendance window and color; assigned shifts snapshot these values through their parent FK. |
| Calendar | Present | Existing calendar and date controls retained. |
| Leave grants | Partial | Existing day/Gregorian-year ledger remains; Radan month and HH:mm grants are not emulated by lossy decimal conversion. |
| Leave balance/cardex | Present | Existing canonical leave entries and balance projection retained. |
| Leave transfer | Absent | Not implemented; exact minute-ledger and carry/burn/buyback semantics require a separate persistence slice. |
| Shift definition | Partial | Named definition added separately from employee assignment; reusable calendar-template equivalence remains incomplete. |
| Shift assignment | Present | Working-hours FK and bounded next/two-day attendance window added; old standalone assignments still calculate as before. |
| Employee shifts | Present | Existing employee shift view retained. |
| Employment decisions | Present | Existing lifecycle commands retained; inaccessible Radan decision editor was not reconstructed. |
| Backup | Absent | No implemented backup command found in the repository; an operational backup service is outside this HR-only candidate. |
| Reports | Partial | 21 observed titles catalogued; 18 canonical-data projections, user/group/contract filters, ordering, hours/minutes and core totals added. Calculation-execution, forgiveness and Arpa explicitly unavailable. This does not recreate unknown 52-coefficient formulas or claim identical report output. |
| Request patterns/workflows | Partial | Existing maker/checker safeguards retained; configurable multi-step requesters/approvers and pattern assignment are not implemented in this candidate. |
| Request history | Partial | Request type/person filters and actual creation-date boundaries added; finer hourly/daily/replacement subtype parity remains incomplete. |
| Payslips | Partial | Existing payroll/Finance boundary retained; Radan Excel payslip import not implemented. |
| Remote-work request | Absent | Hourly/daily request with validated interval, existing HR approval and record persistence added; no invented attendance-credit formula. |

## Compatibility and boundaries

- Additions use existing HrRecord persistence; no schema/migration/dependency/lockfile changes.
- Device legacy six-value payloads remain accepted and padded. New clients send appended fields. Legacy contract/leave values remain readable.
- Producer: HR API and additive HR contracts. Consumers: current HR forms, lists and reports. API must ship before Web.
- Group membership uses parentId/employeeId FKs and existing branch/actor checks. Working-hours parent references are checked in the same transaction and schedule values copied into assignment data. Client cannot supply server-managed schedule output fields.
- Generic list creation-date filtering is opt-in; effective-date filtering remains the default. Creation-date upper bound is exclusive next UTC day. Sort is allowlisted and always composed with existing authorization scope.
- Reports consume only authorized canonical projections. Missing metrics remain unknown rather than zero. Contract filtering uses contract records, not employment-kind labels. Undated reference catalogs are kept separate from date-filtered result rows.
- Existing UI components/CSS are reused. No Radan theme, redesign, synthetic live records, automatic grants, payment or deployment.
- Only observed Radan features were introduced; no additional market-product feature was inferred. Existing Nora capabilities outside this comparison are not removed.

## Validation

- API HR: 111 tests passed, 26 isolated-DB tests skipped; an additional exact-shift-end regression passed afterward (no operational DB used).
- All 117 Web HR tests passed with one worker and a 30-second host-adjusted timeout; committed test limits were not changed. A new overtime-total regression is checked separately.
- API/Web typechecks and scoped lint passed. Production Web compilation succeeded; final build completion and exact-head hosted CI remain gates.
- Targeted report tests cover identity-safe group/contract filtering, minute formats and unknown-metric totals. New API tests cover form validation, legacy devices and authorization-preserving creation-date bounds.

## Remaining work

This candidate is not completion of the user's whole transfer request. Finish the unresolved rows above using observed evidence and approved data boundaries; do not label them delivered, silently substitute zeroes, store network credentials in generic text columns, or assume statutory payroll rules. Full transfer must not be marked complete merely because the bounded candidate passes tests.

Production Web build succeeded with65 routes. Long shifts cannot repeat daily over a multi-day assignment range: a single start day is required to prevent duplicated attendance attribution. No claim of a reusable Radan calendar-template engine.
