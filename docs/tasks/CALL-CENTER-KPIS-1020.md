# CALL-CENTER-KPIS-1020

Owner request replaces exactly the four top Call Center KPI cards. PC-C; branch codex/pc-c-call-center-kpis-1020 from develop83f5daa3 (merged PR1002). All nine contacts columns, their order/content/centering, the request queue and other report cards remain intact.

## Metric definitions confirmed by the owner

All counts are calls in the selected authorized branch, across both directions, independent of list/report filters. Synthetic calls and future occurredAt values are excluded. Server asOf is the common upper boundary. Zero is displayed only after a successful response; loading and fetch failure remain distinct.

- Today's calls: occurredAt from Tehran midnight through server asOf.
- This week's calls: occurredAt from Saturday midnight in Asia/Tehran through asOf. This is the current calendar week, not a rolling seven-day window.
- Calls without outcome: all calls through asOf with outcome NULL. NO_ANSWER is a known outcome and is not counted as missing.
- Calls requiring follow-up: calls explicitly linked by ticketId to a non-CLOSED CALL_CENTER_REQUEST with at least one OPEN Call Center follow-up in the same branch. A call counts once regardless of the number of tasks. Unlinked calls, closed requests and completed/cancelled tasks do not qualify.

GET /customer-affairs/call-center/kpis uses the existing authenticated read/route/branch permissions and private no-store response. One SQL aggregate snapshot computes all four values; no private text is decrypted and no history rows are transferred. Customer Affairs owns request/call predicates; the existing Tasks public query port owns the OPEN-task predicate. No schema, migration, grant or dependency change.

The four informational cards keep the existing four-column desktop/two-column narrow layout. Scope and definitions are visible. They refresh on branch/workflow/reload changes and every60 seconds, with cancellation on unmount/scope change. Failure displays dashes and retry, never fabricated zero. Removed action-card shortcuts do not change queue views or queue branch scope.

## Validation

Targeted PostgreSQL tests cover exact Tehran day/Saturday/year boundaries, a known NO_ANSWER versus missing outcome, multiple tasks per call, multiple calls per request, closed requests, completed tasks, synthetic/future records, unauthorized branches/revoked read permission, genuine zero and absence of private decryption. Web transport tests verify branch/no-store/abort scope and no list-filter payload. Final lint/types/build, browser and runtime evidence is recorded in PROJECT_STATUS.
Validation complete:18 Web and14 PostgreSQL/read assertions/tests, scoped lint/types and optimized builds pass. Chrome/Edge use an isolated mocked transport fixture to verify zero/error/retry and unchanged table/dossier behavior. Local build load caused default5s test timeouts and a browser CDP response timeout; the unchanged tests pass with a local20s deadline and browser response wait60s after compilation. No CI gate changed. Runtime build PCZe1AvGnyaomT4tsxgch is verified on3000 with API health200 and unauthenticated KPI401.
