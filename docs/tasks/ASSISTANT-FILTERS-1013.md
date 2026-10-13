# Assistant versioned report filters

Owner PC-C; branch codex/pc-c-assistant-report-filters-1013.

## Contract and scope

The v1 fixed actions remain supported. New v2 action routes accept only startDate,
endDate (paired ISO civil dates), originId, destinationId and branchId. Dates are
inclusive, at most 90 completed Tehran days; default is the previous seven days.
The preceding comparison has equal civil-day length. Historical DST gaps use the
first real instant of the local day. UTC storage and separate decimal currencies
remain unchanged. No legal-company selector or automatic scope expansion exists.

Sales owns calculations and contract route/date predicates. Native read-all Sales
permission remains necessary; a selected branch must additionally be assigned to
the actor. CRM cohorts retain authorized branch scope. Route conversion is explicitly
unavailable because the source does not identify routes for every contacted lead.
Current contractual balances apply route/branch only: the date range is never
presented as a historical balance. Accounting receivables/refunds remain pending.

The registry adds three filtered source versions plus bounded filter-option lookup.
All executions use pre/post IAM and fixed GET transport. Aggregate release also
rechecks the selected branch. Option labels come from public MasterData and IAM
directory contracts; incomplete option coverage is disclosed. The separate ERP
read entrypoint retains transaction read-only enforcement. No model traffic,
cache, migration, dependencies, business writes or new permissions.

Web has an expandable filter component with the existing Persian DatePicker.
Changing filters cancels/discards old output. Versioned validators reconcile
source filters with envelope/request and retain personal evidence validation.

## Verification and release gates

Targeted native tests, owner query tests, Web contract/proxy/render regressions,
API/Web TypeScript/lint/build and isolated PostgreSQL-to-BFF-to-Web validation
are required. Tests cover invalid/oversized windows, historical Tehran DST,
foreign branch, route filtering, unchanged v1, current balances and exact money.
CI must pass on final head and merged develop before localhost cutover.
Synthetic reconciliation is not owner approval of live financial data.

Deploy the ERP read API, independent assistant and Web together after green CI;
Core ERP and its database are unchanged. Preserve previous process roots/builds
and restore those three processes on failed smoke checks. No database rollback.

## Prior delivery

Tool-infrastructure PR #819 merged at ebcb016f. All four postmerge workflow runs
passed. Loopback4300 runs that revision; rollout evidence is in ignored local
assistant-tools-1013/tmp/tools-runtime. This document does not claim v2 deployed.

## Next gate

Simulated-provider orchestration and session-only conversation preparation follow.
Real provider use awaits explicit processing/retention/cost policy. Finance-approved
receivables, business thresholds and pilot acceptance remain owner decisions.
