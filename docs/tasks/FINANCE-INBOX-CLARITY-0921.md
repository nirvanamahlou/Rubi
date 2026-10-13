# FINANCE-INBOX-CLARITY-0921

PC-A; isolated branch from origin/develop@cba76029. Presentation-only finance request inbox redesign.

- Compact bordered request list, explicit selected row, request count and review labels.
- Readable amount, party, reference and due date; full description stays in the details pane.
- Responsive filters, sticky scrollable desktop details, and mobile selection scrolls to details below the header.
- Existing receipt verification, supplier payments, ticket purchase cost, ticket payments, versions and document-delivery rules are unchanged.

Overlap reconciliation authorized by the owner: the old local reservation UI worktree removes ticket-cost/payment handlers and renames @nora to @rubi. These regressions were not imported; latest develop is authoritative. No old worktree was edited, reset, stashed or overwritten.

No API, schema/migration, dependency/lockfile, operational data or localhost:3100 changes. Review and merge separately from Sales. Do not auto-merge.

Validation: 11 focused component/API tests, scoped ESLint, Web TypeScript and production Web build (50 pages) passed. Browser visual verification was not performed. Initial environment-only missing contracts declarations were resolved by building the local contracts workspace; dependency versions were not changed.
