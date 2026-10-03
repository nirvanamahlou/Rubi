# Customer Affairs popup forms

PC-B, branch `codex/pc-b-customer-affairs-form-dialogs`, live stacked base `304953b`.

Convert seven editing surfaces (lead, ticket, followup, qualification, ticket outcome/escalation, referral and communication) to the existing Nora/Radix modal primitive. Keep list/detail mounted behind creation forms. Search/filter controls remain inline. Dialogs have Persian accessible titles/descriptions, scroll within viewport, trapped focus and return focus to the opener. Outside clicks do not discard input; saving blocks cancellation/field edits, errors remain inside the dialog. No API/data/schema/dependency/shared-component changes.

Primary target: authenticated desktop on corporate network, responsive mobile. Existing Next/Nora design system retained. Targets (not measured): p75 LCP 2500ms, INP 200ms, CLS 0.1, initial JS 200KB gzip + route 80KB, Lighthouse a11y 90/performance 80; WCAG AA owner PC-B.

Validation: scoped ESLint, 30 tests across five files, typecheck and 46-route production build passed. Authenticated browser verified lead/ticket popups, customer lookup, followup/calendar, qualification and communication dialogs; Escape returned focus to the opener. Mobile viewport 390px had a 358px dialog and no horizontal overflow. No business submissions were made. The initial build lacked the public API variable; it was replaced by a successful build with `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4190/api/v1`, and data/company lookup verified afterward. Final Web3100/PID10196; API4190/PID12504 retained. No merge.
