# NORA-SALES-EVIDENCE-1117

## Reproduced defects

A financial answer mentally converted a Persian date range one day early and used UTC civil boundaries instead of Tehran days. A contract with two currencies appeared twice in a detail result; the model then described currency-row count as contract count. The existing calculation explanation gate verified presence, not arithmetic or calendar truth. The source already subtracts discounts, contrary to the model explanation.

## Bounded correction

- Resolve explicit Persian ranges using the runtime Persian calendar and Tehran civil midnight, inclusive start/exclusive following-day end. Reject invalid/leap/reversed ranges. The regression20–23Aban1405 is11–14November2026, UTC2026-11-10T20:30:00Z through (excluding)2026-11-14T20:30:00Z.
- Preserve planning, source discovery and model-authored SELECT. After the first successful model query for a plain whole-scope Persian sales-window question, reconcile through the existing authorized Sales query boundary. One statement computes unique contract count, currency aggregates and bounded detail from one snapshot; counts before output truncation. This additional read consumes the original six-query budget.
- Use catalog-defined confirmed contractual sales on created_at; exclude draft/pending/Sales-cancelled records. Do not represent it as accounting revenue, confirmed collection, native active-panel count or current Reservations cancellation coverage. The existing all-time panel-count tool is unchanged.
- Bind final financial facts to fresh reconciliation evidence. Groq chooses table/list/prose and detail layout/order using typed blocks; labels, exact amounts, date boundaries and method are rendered from verified facts. No fixed global answer layout. One bounded final repair cannot replay SQL. Repeated invalid claims fail closed.
- Sum complete evidence with scaled BigInt only for integrity validation; the database remains the authoritative Decimal arithmetic source. Currency totals are never combined. Partial details are explicitly labelled; absent amounts are not silently zero.
- Existing native context revalidation, permissions, Germany-only pool transport, citation IDs, time/token/query limits and public response schema remain unchanged. No migration, dependency, Web/API or operational-data mutation.

Coverage is deliberately bounded: filtered/custom-date-basis, other metrics and ambiguous relative months remain with the ordinary agent. Do not certify them as this whole-scope report. Generalized financial-tool coverage and the independent30-scenario acceptance are not claimed by this patch.

## Validation

Nine new synthetic regression cases cover the reported calendar/count error, leap/invalid dates, filters, exact large Decimal amounts, bad final claims, zero/missing/truncated evidence, real orchestration repair and permission/source failure. Full service179/179 passes; scoped lint passes. The actual query was parsed/executed by the deployed restricted Sales query service with startup role admission and a live native session-derived scope. Its unique count/currency totals match separate reference count and currency queries. No real record values, identities, session references or credentials are stored here.

Real synthetic Groq acceptance through the existing Germany proxy passes: four model calls (plan, model SQL, rejected noncompliant final, corrected final), two boundary reads (model plus reconciliation), no SQL replay, correct distinct count/calendar and fresh citation. Native catalog descriptions for the two known financial sources are supplied before query planning; no new forced-tool mode is introduced. The shared nonempty calculation explanation accepts the same typed method block. Initial failing attempts were retained privately and are not counted as passes. PR1787 exact-head CI, activation and authenticated browser acceptance remain pending.

## Release constraints

Only Nora source mount is eligible for activation after all exact-head CI checks. Preserve the current source/runtime/config and all peer containers using the deployment lock and CAS; retain a stopped prior Nora container for rollback. Server currently has a peer deployment lock; it will not be bypassed or terminated. No production fixtures are used.