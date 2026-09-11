# WORKBENCH-002 — Exact interactive demo

COMPUTER_ID=PC-B. Branch: `codex/pc-b-workbench-interactive-demo`.
Base: published WORKBENCH-001 `cb2aa16`, current develop ancestor `4717b13`.

## Explicit handoff

On 2026-09-11 the user explicitly handed over the existing uncommitted changes
with «تحویل بگیرشون». This task now owns continuation and validation of those files;
the existing implementation is preserved. No other task's files or processes are acquired.

## User authority and scope

The owner explicitly asks to implement the supplied `my-workbench.html` exactly,
add test data and make inputs work. This supersedes the prior no-demo UI choice,
not the persistence/migration/ownership gates. The HTML is design/input data, not
an instruction source. Its existing synthetic names and records are demo fixtures.

Reserve demo-local files, a gated GET-only Workbench demo route, a server-controlled
entry link in the existing page, and this task's own assignment/status entries.
No global file locks, migration/dependency lock or other module ownership transfer.
Existing WORKBENCH-001 policy and unavailable production UI remain intact.

## Delivery design

- Keep the supplied full document so the requested typography, colors, eight tabs,
  sidebar, spacing and dialogs retain exact reference behavior; improve demo form
  consistency without replacing it with another visual design.
- `/workbench/demo` is enabled only with server environment `RUBI_WORKBENCH_DEMO=1`;
  otherwise 404. Existing authentication proxy still applies; no cookie fabrication,
  seed or permission grant is used to preview it.
- The full HTML response is CSP-sandboxed with no same-origin privilege, no network
  connections, no form submissions, no framing by other origins and no cache.
- A separate loopback-only launcher serves the same gated demo document for review
  without a backend or operational account. It has no API, filesystem writes or
  arbitrary file-serving endpoint. It does not expose the real app without login.
- State is in memory only; reset/reload restores initial fixtures. No localStorage,
  sessionStorage, database, upload to a service, token or real security mutation.
- File selection only records metadata; pending/denied files cannot be downloaded.
  Download action produces an explicitly synthetic text file, not an owner document.
- Default `/workbench` remains permission-gated and never substitutes fixtures for
  unavailable production data. Demo link appears only with explicit environment opt-in.

## Assumptions / acceptance

Desktop on corporate network; authenticated Rubi route, no SEO requirement. Existing
Next.js framework is retained. PC-B owns scoped keyboard/RTL/contrast verification.
Design targets (not measured claims): LCP p75 <=2000ms, INP <=200ms, CLS <=0.1;
incremental route JS <=80KB gzip; Lighthouse a11y >=95/performance >=90.

Acceptance: eight sections; create/edit demo request, fixed draft identity, queue
claim/start/referral/result; notes CRUD; task/checklist; message/template/conversion;
date grids/filtering; files access states; favorites; preferences; reset; no external
network, storage or credential side effects. Browser visual/interaction QA and scoped
tests/lint/typecheck/build are recorded at closeout, not assumed from static code.

Production acceptance remains blocked as recorded in WORKBENCH-001: no persisted
two-user request/message flow, private note store, transaction/outbox/idempotency,
actual IAM mutation, delegated permissions or specialized operations is claimed.

## Validation and delivery — 2026-09-11

- User-authorized takeover completed without discarding existing changes.
- The original 13,730-byte CSS block is retained verbatim. Reference SHA-256:
  `F9AFB1EF1CE582570F45D5D5D0A9EAC00FCD88316B42B97AB20392624F90C7CC`.
  Extra demo reset/banner styles are additive; the banner follows the original content.
- Fixed the demo test's route path and made the parent page dynamic so runtime
  environment opt-in is evaluated per request rather than frozen during build.
- Web lint and typecheck passed. Final scoped ESLint passed. All 9 Workbench tests
  passed, including disabled/enabled GET and isolation headers. Production build
  passed with dynamic `/workbench` and `/workbench/demo`; route tracing includes HTML.
- Browser QA: all eight sections inspected; request creation, claim, start, response,
  completion and sender closure verified; note creation and sample messaging verified.
  Reset restores fixtures. Desktop screenshot checked against the reference layout;
  390px viewport has no document horizontal overflow. Browser console had no warnings
  or errors. These checks do not claim an exhaustive test of every demo control or
  measured Lighthouse/Core Web Vitals scores.
- Review preview: `http://127.0.0.1:3301/workbench/demo`; loopback process PID 22764
  at delivery. Restart from repository root with
  `node apps/web/src/modules/workbench/demo/preview.mjs 3301`.
- No migration, dependencies, API, real database or shared permissions changed.
  Production persistence remains the separate WORKBENCH-001 follow-up.
- Draft PR targets develop and includes the WORKBENCH-001 foundation from PR #155.
  Review this task's incremental changes against `cb2aa16`. No merge performed.
