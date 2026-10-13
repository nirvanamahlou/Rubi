# Accounting prepared-component integration — 2026-10-12

PC-B, base develop 61167e61, branch codex/pc-b-accounting-completion-integration-1012.

The user explicitly released the earlier shared-file hold and authorized PC-B to
connect the already prepared code. This work activates those components; it does
not implement statutory returns, official taxpayer dispatch or new year-end commands.

## Connected behavior

- FinanceModule imports AccountingCompletionModule once, exposing the existing
  seller GET/POST and completion read endpoints through the actual Auth/Permission guards.
- The shared accounting workspace dispatches 32 exact prepared routes only after
  successfully loading the selected authorized book. Unknown routes and failed
  snapshots never render these screens. Existing closing/opening and inactive
  connection-settings handlers are preserved.
- The navigation registry now includes tax parties, aggregate history and uncollected
  days using existing observed catalogues. Their remaining domain dependencies stay visible.
- Tax reference forms/lists, seller profile, account-structure report, journal-line
  report and read-only year-end diagnostics are reachable through the shared shell.
- Seller New navigation retains bookId; seller and tax reference save/delete reuse
  browserRandomUuid so ordinary HTTP LAN contexts do not depend on crypto.randomUUID.
- Year-end notice explicitly distinguishes working prerequisite checks from unavailable
  journal issuance. No diagnostics page adds a financial command.
- Support registry remains conservative: 91 total entries, 48 supported, 39 dependent,
  4 source-error. A mounted dependency form is not labeled operational.

## Validation and runtime

Targeted checks cover the real FinanceModule registration and HTTP guard boundaries,
selected-book route rendering, failed snapshot rejection, preservation of legacy
handlers, each of the 32 real screens, source metadata and English coverage. Existing
service regressions retain exact decimal and branch/book checks. API/Web TypeScript
and scoped lint are required, followed by full exact-head CI and production builds.
The large 37-field declaration screen gets a bounded 15-second render-test timeout;
its dependency controls remain disabled. No gate or assertion is removed.

No schema, migration, dependency or permission grant changes. Reuse PC-B rubi Compose
Web3100/API4192, the existing project database and existing document-storage mount.
Authenticated acceptance uses the user's existing session with read-only inspection;
no source-system records or live business test records are created. Deployment and
final browser receipts belong to the delivery PR and local runtime evidence.

PR800 was merged at fe673a0b and its independent candidate was started locally.
Its historical "unconnected" notes are superseded only for the exact routes and API
registration covered by this work. All other domain/provider limitations remain.

Local validation: API25 and Web50 targeted tests passed (including all32 real screens and English coverage). API/Web TypeScript and scoped lint were checked; final CI remains the merge gate. Initial checks caught three unregistered catalogue destinations and two missing translations, now corrected.
