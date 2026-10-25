# Missing-outcome KPI drilldown — 2026-10-25

User approved one row per call, existing completion form and contact dossier actions, server paging newest first, selected branch and all-history scope independent of contact-list filters.

POST /customer-affairs/call-center/without-outcome accepts bounded paging and revision. It selects null outcomes through server time, excluding synthetic data, and decrypts only the requested page. Sorting uses occurredAt descending and id ascending. Repeatable-read count/page and revision mismatch protect paging against silent duplication after new calls or completion. Existing encrypted payload and audit-based call completion remain authoritative.

The missing-outcome KPI and drilldown both intersect report and contact permissions. Report-only visibility cannot expose contact identity; users lacking contact scope have zero actionable missing-outcome calls. Other KPI definitions are unchanged. Branch and auth are resolved server-side. The modal supports loading, empty/error/retry, keyboard activation, dialog Escape and existing contact form. Save refreshes KPI and modal; only a non-null outcome removes a row. Dossier action uses the existing panel. No migration, dependencies or telephony configuration change.

Validation: 14 PostgreSQL tests pass including duplicate-contact per-call paging, synthetic/future/other-branch exclusion, KPI/count agreement, stale revision rejection and removing completed rows. Eight existing Web tests pass. Affected lint/API typecheck/build passed. Web build and browser acceptance recorded below.

Browser acceptance: authenticated local modal displays real per-call records; existing completion editor opens, cancel returns to list, dossier action opens the selected contact. Enter activation and Escape closing verified. No real business outcomes modified during UI review. Final typography keeps phone/time on one line; shared focus-return hook reused. Web production build passes65 routes (final typography rebuild recorded on completion).

Final typography/focus build passed65 routes and TypeScript; local Web3000 uses .next-outcome-final-1025, API4000 uses .api-outcome-drilldown-1025. Prior artifacts retained. No PR/merge/deployment performed.
