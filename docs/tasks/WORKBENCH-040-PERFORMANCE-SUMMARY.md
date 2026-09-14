# WORKBENCH-040 — Personal performance summary

PC-B; codex/pc-b-workbench-performance-summary, based on WORKBENCH-039.

Screenshot582 redesign replaces the raw activity-event list with summary cards: all-time approved personal leave-request count, net amount and period of the latest approved payslip, unique own confirmed-contract customers and confirmed sales count in the selected range. Today attendance and dated HR shift plans have separate panels; leave balances and sales totals remain compact. Raw recent activity rows and audit-count tiles are removed from the UI, while the existing API activity contract remains compatible.

HR adds optional approvedLeaveCount and todayAttendance response fields, retaining self-user/employee and branch scope even for managers. The date uses HR's Tehran clock; attendance is scoped to that calendar day. Latest approved correction punches supersede originals consistently with HR attendance rules. First entry and last exit are returned, with Persian digit normalization and a fail-closed daily row limit. Counts use a full approved request count, never the capped ten-row list.

No account is automatically associated with an employee. Missing personnel links and denied access never become fabricated amounts or zero counts. The salary card shows the actual payslip period and net approved amount, not a claim that a bank transfer occurred. HR data remains independent of the sales range. No schema, migration, seed, dependency or authorization changes.

Validation: 26 focused API tests and all 50 Workbench Web tests passed, including self/branch isolation, salary privacy, Tehran midnight and correction precedence. Scoped API/Web ESLint and API typecheck passed. Build results are recorded at delivery. This branch does not replace shared Web3100/API4190.
Delivery gates: API production build and Web production build with TypeScript/46 routes passed. Source reservations released for PR review; shared runtime unchanged.

## Authorized merge and local activation

User explicitly authorized merge and activation. PR268 merged into develop at eb6af3ffcadf395806ec8ee6875080680d86baaa after all CI gates passed. Runtime branch codex/pc-b-workbench-summary-3100 preserves the existing all-sections code, Finance and Customer Affairs, plus current develop and both Workbench fixes.

Combined monorepo build passed all six tasks and 46 Web routes; 26 API and 50 Web focused tests passed. Web3100 PID8332 and API4191 PID3952 started from runtime code f62d13c2, build unified-1Xwg0O1XxOGe7M7jeb-GA. Runtime identity and API health returned200; login200 and protected Performance/Messages/Finance/Customer Affairs routes307 were verified. Startup error logs were empty. No authenticated user data was modified; account-level visual checks are not claimed. Existing database, documents and credentials were preserved without migration or seed. Previous runtime checkout remains available for rollback.
