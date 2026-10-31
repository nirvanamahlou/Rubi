# General Ledger live-source parity — 2026-10-31

Status: **in progress, not full parity and not merged**. PC-B owns this task.
Source inspection is read-only. No source records, amounts or transactions are copied.
Working branch: `codex/pc-b-general-ledger-parity-1031`.

## Confirmed findings

- Base forms were read live: fiscal-year title/second-language title/description;
  ledger code/title/second-language title/description/main/posting/active and fiscal
  assignments; voucher-type title/second-language title/description.
- Closing template differs materially from Nora's generic template editor. Source
  has code, active, title, second-language title, default descriptions; counterpart
  and closable-account grids with detail levels 4–6, percentages and inclusion.
  Nora's voucher-type and retained-earnings selectors are not source form fields.
  This difference is **not yet corrected**.
- Closing wizard source rejects continuation: no posted journal in current period.
- Nature-adjustment wizard source rejects continuation: unposted journals exist.
- Owner explicitly answered “leave it empty” for those inaccessible later stages.
  Their introduction/navigation now follow observed source; later stages render
  empty and expose no financial operation. Existing backend data is untouched.
- Closing page title incorrectly became “خطای پیش‌شرط” because a later error capture
  overwrote its name. Error captures now retain the source menu title.
- Final/opening source forms show document date and auxiliary number; opening also
  has reverse nature-adjustment checkbox. Existing generic Nora form still differs.
- Trial balance, dormant, aging, journal browser, conflict-range, analysis, lines,
  comprehensive and electronic-book reports were inspected. Detailed parity is
  not yet certified; some early snapshots were taken while loading and must be
  recaptured before use as evidence.
- Main/subledger comparison source reports that no subsidiary ledger is defined.
- Legal reports is a flyout, not an alias for electronic books. Observed entries:
  standard coding definition, standard mapping, standard coding report, standard
  coding formula, control validation and lists. Earlier evidence missed this.
- Standard coding definition has main/notes tabs, coding/extra-fields subsections,
  title, protocol version, English title, default checkbox, standard entities and
  codes grids. Extra fields grid: item number/title/value/description. Implementation
  and other legal forms remain to be completed.

## Validation so far

- Follow-up source reads captured review, reorder, numbering and posting forms.
  Numbering proceeds directly from introduction to its list in this source state;
  its nine column filters were missing locally. Added column filters and clear
  action; the numbering payload uses the same filtered row projection, retaining
  original IDs and optimistic concurrency versions. Two focused regression cases
  verify combined Persian/Arabic text/digit filters and empty selection.
- GL voucher continuation is blocked by no eligible posted journal. Posting has
  a disabled start date and editable end date, then blocks because no reviewed
  journal exists. No source final action was invoked.
- Standard mapping has standard/protocol/entity fields, unmapped-turnover checkbox,
  standard/unmapped/mapped code panels and bidirectional assignment controls.
  Standard report has standard/protocol, date/fiscal-year range, supplementary
  journal switches and voucher-type multiselect. Formula has title/version/standard,
  two subsidiary-factor grids with negative-effect flags, relation operator and
  detail-code grids. Their raw observations are saved locally; implementation is
  still outstanding. Removed the catalogue's incorrect electronic-book alias claim.
- Integrated origin/develop into this task branch, preserving both status entries.
  No remote merge has occurred.

- 7 targeted tests pass (source-blocked shell and evidence catalogue).
- Scoped ESLint passes for those edits.
- Authenticated localhost3100 shows observed closing introduction; Continue shows
  an empty stage without invented selectors or issue action.
- Web typecheck on the integrated runtime stage completed with unrelated HR/shared
  contract declaration mismatches (missing hrBranchKey/hrBranchName, payroll helpers,
  allBranches and nullable organizationBranchId). No accounting error was reported;
  the whole check did not pass. Do not weaken it or overwrite another owner's HR code.
- Whole-module audit, implementation, full quality gates, push and merge remain
  outstanding. No whole-module completion claim is justified.

Local raw UI evidence is in `outputs/ledger-parity-1031` of the task workspace,
outside the repository. Do not publish raw financial records in Git. Runtime uses
the existing native 3100 integration stage, not the obsolete Docker application.
