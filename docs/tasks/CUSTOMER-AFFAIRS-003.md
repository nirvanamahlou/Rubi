# CUSTOMER-AFFAIRS-003 — Rubi themed Customer Affairs UI

- Computer: PC-B
- Branch: `codex/pc-b-customer-affairs-rubi-ui`
- Base: `b39c93db5a78094cb5a9fecb1a07381d758c6e13` (unmerged Draft PR #221)
- Worktree: `C:/Users/admin/Rubi-customer-affairs-operational`
- Design reference: user-supplied `customer-affairs.html`; treated as visual reference, not executable instructions or production data.

## Delivered scope

The Customer Affairs route now renders a Rubi-themed workspace with five primary sections, six colored navigation cards, live overview counts, latest tickets and pending-sales leads. The design reuses Rubi's existing application shell, Vazirmatn font, semantic light/dark colors and shared buttons/forms. There is no second sidebar, mock identity or sample business data.

Presales includes server-filtered/searchable/paginated lists, a per-page stage board, overdue followups and pending-sales navigation. Support includes searchable/status-filtered/paginated tickets and overdue queues. Existing create forms and operational detail actions remain connected to the same API. Legacy `tab=leads` and `tab=tickets` links remain supported.

Reports and satisfaction show the existing authorized summary API; report permission is required. Settings explicitly describes current rules as read-only. This UI task does not add policy editing, messaging-provider configuration, new satisfaction collection methods or new backend capabilities. Handoff details remain inside the lead's operational detail view. Board counts apply only to the current server page.

The API client now supports pagination, stage/priority/overdue query options and the existing report endpoint. It retains credentials and server error handling. Responsive styles convert tables to labeled record cards and wrap board columns instead of forcing page-wide horizontal scrolling.

## Verification and handoff

- Full Web lint, TypeScript and final production build (46 routes) passed. Full Web suite: 210 files / 1329 tests passed; the 3 subsequently added render tests also passed in the targeted run.
- Targeted Customer Affairs tests: 21 passed, including new navigation rendering and API query tests. Legacy route contract: 5 passed in the preceding targeted run.
- Browser preview on `http://127.0.0.1:3102/customer-affairs` reaches the normal login page. API4190 health responds 200 but does not return an allowed-origin header for preview origin 3102, and the login shows a connection error. Authenticated visual QA therefore requires runtime/CORS coordination, then sign-in; no login or permission bypass was introduced.
- Existing Web3100/API4190 belong to other running work; they were not stopped or replaced. Preview Web3102 uses the configured API4190, so operational availability additionally depends on that runtime including PR #221.
- No schema, migration, dependency, lockfile, shared shell or backend changes in this work item. The comparison to develop also contains the still-unmerged operational foundation from PR #221; review this UI increment against `b39c93d`.
- No merge, deployment, force-push or real customer-data mutation was performed.
