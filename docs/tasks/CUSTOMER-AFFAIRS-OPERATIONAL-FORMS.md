# Customer Affairs operational gaps — existing-contract slice

PC-B branch `codex/pc-b-customer-affairs-operational-forms`, stacked on the live combined `cc9970b`. This implements a bounded subset of the user's larger backlog, not all external/cross-module work.

Implemented: popup editing of request/ticket core information, preserved untouched write fields and references, optimistic concurrency; source and special preferences at creation/edit; scoped public HR directory search/pagination for user-linked employees; assignment at creation/edit/referral; supported lead transitions/loss reason with no shortcut around qualification/handoff; explicit issuance, correction and document-resend ticket categories; corrective action status/result/effectiveness form and loss display. Customer selection links an existing customer, not a fabricated conversion. Unknown stored ticket categories and existing assignments remain usable.

No backend/schema/dependency changes or business data submissions. HR directory is consumed through its existing authenticated, branch-scoped public endpoint; missing permissions are shown honestly without granting them. Producer ownership stays unchanged.

Remaining scope: conversion probability persistence; automatic reminders/tasks integration; customer creation/conversion and Sales-owned acceptance UI; external messaging and automatic survey delivery; structured dissatisfaction reasons; live website ingress/site filtering. These need new contracts/schema or owner coordination and are not marked implemented. Actual travel/refund/payment actions stay with their owner modules.

Frontend assumptions/targets retained: authenticated desktop/corporate, responsive mobile, Nora/Next unchanged; WCAG AA owner PC-B; p75 LCP2500ms/INP200ms/CLS0.1, JS200KB initial+80KB route gzip, Lighthouse a11y90/perf80 are targets, not measured claims.

Validation: scoped ESLint/typecheck and 46-route production build passed. All 35 tests passed; a repeated filesystem-read contract test timed out under simultaneous build load, was optimized to read once, then all tests passed in 2.09s. Browser verified populated edit fields, customer lookup, stage options and conditional loss-reason input without submitting business changes. The checked branch has no HR employees linked to IAM users; setup must supply actual assignable staff. No invented recipients or permission grants. Runtime cutover limited to Web3100 with public API4190; API process retained. No merge.
