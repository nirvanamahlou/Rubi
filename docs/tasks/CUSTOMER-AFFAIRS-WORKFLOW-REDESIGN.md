# Customer Affairs workflow and interface redesign

PC-B owns this Web-only task on `codex/pc-b-customer-affairs-workflow-redesign`, based on the combined runtime `87239f4`. The user requested a more logical structure and suitable frontend following the product review.

## Result

- Four primary destinations: overview, requests/leads, support tickets and reports. Overdue followups and waiting-sales records are contextual filters; overdue tickets are a support filter. Legacy URL views remain supported, including satisfaction under reports.
- Overview prioritizes real overdue followups and retains live counts, latest tickets and pending sales. Six duplicate navigation cards are removed. Tabs fill four columns and collapse to two on mobile; Nora theme tokens and keyboard focus styling are preserved.
- Lead creation supports origin, travel dates, services and optional budget/currency. Passenger count has no invented default. The current API still requires a positive passenger count.
- Qualification requires an explicit six-item checklist; unchecked criteria reach the API as false. Sales handoff still depends on the existing server state and customer checks.
- Detail views provide editable next action/date via version-checked existing PATCH endpoints. Only writable fields are serialized. Communication records distinguish internal notes, calls, meetings and received customer replies; no external delivery is claimed.
- Resolve, close, reopen and escalation capture a reason; resolving/closing also captures the actual outcome. Failures retain form content. Timeline events use Persian labels. Referral and handoff responses appear alongside the original record.
- Ticket actions follow the current stage: initial review for new tickets, close only after resolution, reopen for terminal cases and satisfaction after resolution/closure. Inapplicable actions no longer crowd the detail screen. Followup dates use local display values while API timestamps remain UTC.
- Ticket categories and destination modules have Persian choices. Recipient unit remains a required field because the existing referral API requires a unit or assigned user.

## Scope and remaining dependencies

No database, permissions, schema, dependencies, shared API contracts or other modules are changed. Existing records are preserved. Sales acceptance UI, external message providers, automatic website ingestion, identity creation, advanced reference pickers and expanded report metrics remain separate integration work. This task does not claim those capabilities were completed.

Desktop/corporate network is the primary target, with responsive mobile support. Design targets are LCP 2500 ms, INP 200 ms, CLS 0.1, WCAG AA reviewed by PC-B, route JS budget 200 KB initial plus 80 KB route-specific gzip, Lighthouse accessibility 90 and performance 80. These are targets, not measured production results.

## Validation

Scoped ESLint, 29 focused tests across five files, typecheck and the production build (46 routes) passed. Authenticated browser checks verified populated overview/list/detail views, unchecked qualification criteria, local followup date editing and stage-specific ticket actions. Ticket detail at 390 x 844 had no horizontal overflow. No business forms were submitted during QA; stored records and API4190 were preserved. Final Web3100 production runtime was restarted successfully. Performance budgets above have not been benchmarked.
