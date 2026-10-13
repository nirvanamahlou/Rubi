# Phase2 — explainable recommendations and executive summary

Owner PC-C; base develop4122f5da; user-approved scope on2026-10-13.

## Rules and evidence

PERSONAL_DUE_V2 evaluates authenticated SELF calendar, notes and assigned procurement
records against calendar days in Asia/Tehran. Overdue/today is HIGH, days1–3 MEDIUM,
days4–7 LOW; assigned procurement without a deadline defaults LOW. Existing URGENT
source priority promotes to HIGH and HIGH promotes to MEDIUM; neither can demote
calendar urgency. Sort priority, deadline, then source-qualified ID before the30
record cap. Include the entire seventh local day, excluding day8. Completed or
cancelled records and completed checklists are omitted on each fresh read.

Recommendation identity is source-qualified record ID plus rule ID. A recommendation
requires a READY source with observation time. Return reason, priority, source,
observation time and rule identity; the existing safe ERP link stays on its source
follow-up. Source text is evidence, never instructions. There are no Write tools,
model calls, provider dependencies, persisted recommendation state or notifications.

Web validates policyVersion2 identities, computed priorities/reasons and source
observation times against the returned snapshot. Legacy policyVersion-absent V1
responses remain accepted with their original validation for rolling compatibility.
The current service adds sourcePriority to snapshot records and policyVersion2 to
daily summaries; no public ERP source contract changes are required.

## Display and scope

Show the first5 eligible recommendations with a native keyboard-accessible view-all
expander for the remainder. Each item shows its priority, reason, recorded priority,
source, due time, observation time and safe link. Persian dates use Tehran/Jalali.
Counts describe the bounded visible evidence, never all work across the company.
Partial sources and truncation remain explicit and missing data is not zero.

The fixed daily executive summary retains personal counts, authorized weekly Sales
and separately authorized contractual balances. Show current/previous period dates,
contract counts and exact amount strings per currency, including currencies found
only in the previous period. Never convert, sum different currencies or use LLM
arithmetic. Amounts retain the explicit before-refunds definition and limitations.

Contract-balance recommendation rules are deferred by the user until real data and
business thresholds are reviewed. Accounting receivables still require an approved
Finance source. No urgency, due date or accounting balance is inferred from a
contractual outstanding amount. No permissions, IAM policies or source scopes change.

## Validation and release

Synthetic HTTP tests cover Tehran midnight, day3/day4/day7/day8, source-priority
promotion, deduplication and disappearance after completion on refresh. Existing
HTTP denial, session revocation, source isolation, write abuse, caps and audit tests
remain active. Web tests reject forged priority/reason/source/time/identity and
verify five-item expansion, escaped titles and source visibility.

Local results: service27/27 and Web/translation32/32 passed; scoped ESLint and Web
typecheck passed. Production build and exact-head CI are release gates; PR records
final build/CI/merge evidence. No migration, dependency or operational data changes.
Business reference reconciliation, CEO pilot and production certification remain
separate acceptance steps. Local rollout replaces only PC-C3000/4300 after checks;
existing ERP4000 and readonly source4301 remain available. Rollback restores the
previous built Web and assistant entrypoints; database rollback is unnecessary.
