# HOTEL-TABLE-REDESIGN-1008 — PC-A

Owner requests a complete, uncluttered table-first manual hotel-rate workspace,
explicitly authorizes a CI-gated merge to develop, and confirms removing old hotel
rates in both preview3210 and main3100. A further explicit reply authorizes removal
of the single dependent package-pricing draft and its adjustment in each database,
after backup. Contracts and Master Data must remain unchanged.

## Delivered workflow

- Manual entry is the initial visible mode, not a collapsed section below Excel
  import, summary cards and a long package list. Country, city and searchable hotel
  selectors appear vertically in order and use existing public Master Data options.
- New package opens the editor, resets the selection and changes the panel mount
  key even when already editing a new package. This prevents old local coefficient,
  base and sale input state being reused for the next package.
- A single expandable hotel coefficient table is shared by all of that hotel's
  room types. Default rows are double, single and child with bed. Additional rows
  use adult/child counts and per-child age bounds through themed selectors, below15.
- Every actual room type has an independent base and a purchase/sale table.
  Purchase is exactly base multiplied by composition coefficient. Sale defaults to
  purchase and is directly editable in its cell without changing purchase or other
  rows. Invalid unfinished sale edits block saving instead of silently using a
  previous value.
- Click a priced row, use checkboxes, select all, or select one composition across
  room types. The contextual toolbar supports fixed/percentage increases or
  decreases and a fixed sale value. Changes use purchase, not the previous sale;
  repeated application does not compound. A negative result aborts the whole group.
- Saved packages and their existing search/edit capability move to a collapsed
  section at the bottom. Excel import remains available through a separate mode.
  Existing API, branch permissions, idempotency, CAS and immutable new revisions
  are retained. No dependencies, schema or API contracts change.

## Explicit one-time operational cleanup

This cleanup is not an application startup hook, migration or automatic reset.
Only local PostgreSQL database `rubi_hotel_manual_preview_1008` (preview3210) and
`rubi` (main3100) were targeted. The preserved original preview database was not
modified. Database location and role were checked before each operation.

Scoped PostgreSQL custom-format backups were saved privately, verified with
pg_restore's table-data listing
and SHA256 manifests. Locked target snapshots were checked before deletion to
prevent removal of records created after backup. Deletions were transactional and
referentially ordered; every other public table was compared before and after
within the operation.

| Environment | Packs | Batches | Hotel groups | Room rates | Dependent draft / adjustment |
| --- | ---: | ---: | ---: | ---: | ---: |
| Preview3210 | 390 | 394 | 635 | 4028 | 1 / 1 |
| Main3100 | 1 | 5 | 5 | 3 | 1 / 1 |

Both target catalogs are now empty. Published package-pricing rows were zero and
not deleted. All251 other public tables, including9 existing contracts in each
environment and Master Data, retained their exact row fingerprints. Backups and
operation manifests contain private data and are never committed. Both backups,
SHA256 manifests and completion records were moved with checksum verification to
the primary workspace's ignored `.runtime/backups/hotel-rate-reset-1008` folder,
outside the preview worktree, so later worktree cleanup does not remove them.

## Verification and runtime handoff

Local Sales/Reservations Web tests:637 pass across full and isolated runs,3
existing skips. Under concurrent local builds, three existing rendering/import
tests hit their timeout and passed in isolation; two i18n tests also timed out
locally. No assertions or test thresholds were weakened. Exact source candidate
`3632ba9a` passes all8 GitHub push/PR checks, including the full test suite, full
quality gate, production build and PostgreSQL migration/seed gate. Scoped ESLint
and Web typecheck pass; the final production build generates56 routes. Browser
verification on3210 uses the owner's existing session,
no credentials or permission changes. Actual city/hotel options, shared factors,
two independent bases, inline sale changes, selected-row changes and noncompounding
adjustments are checked using unsaved synthetic inputs, not persisted test rates.
The narrow-view overflow fix removes fieldset intrinsic minimum width and permits
grid children to shrink, keeping wide tables within their own scroll container.
Sale input preserves raw text during typing and formats on blur, avoiding caret
movement and accidental numeric rewriting. A regression verifies each keystroke.

Final authenticated browser check confirms body width731 equals scroll width731,
two room bases100/200 and shared coefficients2/1.5/2.5. Typing235.2 into one sale
cell retains the input until blur, while purchase remains200. Adding a two-child
composition with distinct age bounds and coefficient3 creates purchase300/600;
selecting that composition across rooms and applying10% twice yields sale330/660,
not a compounded amount. All of these inputs are unsaved and cleared after QA.

Only the already-owned Web3210 preview is restarted after build. API4210 and main
Web3100/API4000 processes are not restarted or overwritten. Root workspace and the
other runtime's local edits are preserved. Operational rate cleanup is distinct
from source deployment: main needs its normal develop update/rebuild to show the
new UI. Source integrated first with develop@b322d3c9 and then develop@ce960122,
preserving other work records and synchronizing both new hotel labels and package
price-field labels. The second integration includes another module's additive
migration in Git only: it is NOT applied to either operational database or used
to restart their APIs in this task. Final integration requires fresh exact-head
CI before the authorized merge; private backups and test inputs
never enter Git. Do not refresh the owner's unsaved form for browser verification;
use a separately authenticated tab or their explicit refresh approval.
