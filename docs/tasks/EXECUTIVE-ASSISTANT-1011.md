# Executive assistant — first independent slice

Owner: PC-C. User-confirmed 2026-10-11. Base: develop@b52480e2.

## Accepted scope and architecture

The ERP sidebar ends with «دستیار هوشمند», opening the executive workspace.
Only the executive persona is implemented. The six supplied AI-generated images
are requirements for information coverage, not evidence of company facts, news,
forecasts, probabilities, currency rates or existing business decisions.
ERP remains a modular monolith. The assistant backend is a separate process in
`services/assistant`, with no Prisma, database credentials or ERP module imports.
The same-origin Next route is a transport boundary, not the agent orchestrator.
Use the existing Node 24 runtime without a new framework/dependency; this first
bounded read adapter does not justify another framework or vector database.

Access requires explicit `ui.screen.assistant.executive`, both in navigation and
the independent service. An administrator, role label or client-supplied actor
does not implicitly grant executive access. Existing IAM can assign the new
screen using its public user-management flow. No account/role is changed here.
The service validates the user's active ERP session before each bounded tool
read and before releasing a response. Only the access cookie is forwarded to
the configured ERP origin; credentials are never passed to a model or logged.

The data-processing/provider policy is deferred by the owner. There are no LLM,
embedding, remote news, arbitrary URL, SQL, shell or write tools. The service
reads personal calendar, reminder notes and assigned procurement follow-ups
through existing authenticated ERP endpoints. Financial/business forecasting,
news impact percentages and causal factor weights remain unavailable until
their source contracts, scope and evaluation are approved. Missing data is not
zero. Audit metadata is operational logging, not a business write tool.

## Reference coverage and source gates

| Image / view | Required information | Source and validation gate |
| --- | --- | --- |
| 1 / advisor | Outlook, confidence, urgent alerts, opportunities, daily summary, reasons, risks, recommendations, priorities, decision tracking, source contributions | Approved outputs from other sections; personal follow-ups can use Workbench public reads. Decision records need an approved owner/API; no fake history. |
| 2 / sales | Forecast sales, leads, conversion, top destination, actual/forecast trend, destination shares, funnel, products, demand/channel summary | Sales and Customer Affairs/Marketing public reporting contracts; consistent grain, attribution and backtested forecast. |
| 3 / overview | Sales forecast, margin, cash, risk, three-month trend, explanation, influential news, factor weights, urgent recommendations | Approved per-company Reporting/Finance projections and versioned model; confidence must have a calibrated meaning. |
| 4 / news | High-impact count, risk index, opportunities, affected routes, source/time/link, sales/margin/demand impacts, risk areas/map, recommendations | Approved licensed sources, deduplication, publication/event dates, reviewed impact method; never fabricate headlines or causal percentages. |
| 5 / finance | Revenue, margin, cash, debt, 90-day inflow/outflow, obligation composition, receivables/payables/checks/prepayments, alerts/actions | Authorized Finance API, Decimal/currency, accounting definitions, exact company scope, reconciled ledger and due-date projections. |
| 6 / scenarios | FX/advertising/demand/cost inputs; pessimistic/base/optimistic comparisons; sales/profit/cash/risk; sensitivity; company impacts; history | User assumptions kept distinct from observations; validated baseline and scenario model, versioned coefficients and approved persistence API. |

## Acceptance

- Sidebar last, responsive integrated shell, six addressable views, keyboard use,
  Persian/English, existing light/dark theme and accessible empty/error states.
- No synthetic numbers, confidence, forecast lines, news, decisions or save success.
- Personal results carry source, UTC observation time, overdue/upcoming reason,
  bounded coverage and a safe ERP drill-down. No client-selected user scope.
- Missing configuration, failed source, denied access and no records are distinct.
- Explicit user grant; deny anonymous/admin-only requests; no cookie/body/PII logs.
- Fixed GET allowlist, outbound redirects denied, bounded response size/time,
  bounded concurrency/rate, no automatic retries and independent failure.
- Unit and HTTP integration tests using a synthetic ERP server, UI/contract tests,
  lint, typecheck and affected production build. No operational database testing.

## Follow-up decisions

Identify the actual CEO account for explicit access assignment; select and approve
deployment topology, retained audit sink and data processing policy. Approve each
company-scoped source contract and metric definition before connecting business
data. Forecast validation must compare against held-out history and a naive
baseline; scenario output is conditional on assumptions, not a prediction.
Model choice, RAG ingestion, news providers, recommendations beyond deterministic
follow-ups and business actions require separate reviewed work items.

No migration, dependency change, merge or production/local ERP runtime replacement.

## Verification — 2026-10-11

- Contracts build and all 143 contract tests passed.
- Web focused suites: 57 tests passed (assistant, navigation, access, localization,
  navigation collapse and System Management categories). Web TypeScript and
  scoped ESLint passed, including explicit-grant and escaped-source regressions.
- Independent service: syntax check and 12 native Node HTTP integration tests
  passed, covering two-user isolation, denial/revocation, injection-like titles,
  allowlisted tools, source failure/timeout, bounded results and rate limiting.
- Web production webpack build passed with /assistant and the same-origin proxy.
- Actual built Web was exercised in the in-app browser with a synthetic identity:
  final standalone sidebar link, all six views, source dialog, scenario keyboard
  input/reset, Persian/English, light/dark and 390px mobile layout (no page-wide
  horizontal overflow). A synthetic fixture mismatch in the existing HR bell
  was corrected in the disposable harness; no unrelated product code changed.
- The browser-to-Next-proxy-to-independent-service-to-synthetic-ERP path returned
  two labelled synthetic personal follow-ups, with overdue/upcoming reason,
  source and safe link. No production ERP API or operational database was used.

No migration or dependency/lockfile changes. No real account grant, LLM call,
news-provider connection, corporate calculation, production load/security
certification, deployment or merge. Runtime fixtures live only in ignored tmp/;
production sources contain no synthetic metrics or synthetic authentication.

Handoff: merge only after review and explicit owner authorization. Deployment
must arrange the shared ERP access-cookie boundary, private HTTPS ingress,
retained audit sink and explicit CEO grant before real-source acceptance. Other
PCs should take the reviewed commit, not copy local node_modules or fixtures.
