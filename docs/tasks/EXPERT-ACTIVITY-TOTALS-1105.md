# EXPERT-ACTIVITY-TOTALS-1105

Owner PC-C; base develop e58613d1e; branch codex/pc-c-expert-activity-totals-1105.

User explicitly requests the reference's blue grand-total row at the end of the expert-performance table. Keep current columns, filters, permissions, drilldowns, source-share chart, sidebar and KPI cards. Existing chat authorization covers develop PR, merge after every gate and bounded Web publication.

Totals are sums of the authorized returned expert rows, not an independent all-company report. Shared calls/contacts can contribute to multiple expert rows; the unique-contact column's footer is a sum of per-expert counts. Completion is weighted by the summed call denominator, not averaged percentages. Unattributed calls remain separate. No API, schema, migrations, dependencies or business records change.

Validation:115 Call Center tests across26 files passed, including all7 report tests. New regressions cover every numeric total, weighted completion (1/1 plus0/9 gives10%, not50%), shared rows, zero denominator, unavailable/empty report and noninteractive footer cells. Scoped ESLint, Prettier and diff checks passed. Synthetic rendering of the actual component with actual workspace/leaf CSS verified the blue sticky footer remains at the scroll container bottom before and after scrolling, unchanged complete-row sums,390px no page overflow and dark-theme contrast. Full candidate build/typecheck, hosted gates and release receipt pending.
