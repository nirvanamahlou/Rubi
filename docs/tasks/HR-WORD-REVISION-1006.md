# HR Word revision — 2026-10-07

Owner: PC-B. Source: user-provided Word file `-2821274184116855039_148603269018282.docx`. Scope: Human Resources live workspace and its narrow Workbench/Customer Affairs integrations. No operational data or migration is changed.

## Implemented requirements

- Removed the one-line section subtitles, the selection placeholder, and the report range toolbar. Existing table search and status filters remain.
- Made employee unit optional and branch manager free text; removed unit-parent input. Added inline creation of branch, unit, position, and employee references from relevant forms, with the refreshed catalogs available for selection. Row action buttons have explicit names and destructive styling.
- Replaced grade inputs with a standard seniority catalog, retired the separate grade screen, and kept historical grade values readable. Removed old job openings, contract templates, and HR settings/integration navigation without dropping their stored records.
- Recruitment requests allow empty reason/requester and can add a job title. New applicants require a staffing-plan parent; old opening-linked applicants remain readable/editable. A candidate-row action opens a manager/HR assessment record with required evaluation fields. Selectors display names/titles without record codes.
- Draft onboarding creates a provisional employee visible in Employees; approval activates it, rejection/deletion removes the provisional employee. Promotion hides current position/grade and updates the employee on the approved effective date. Separation owner is optional; employees with completed separation disappear from the active list.
- Contract subject/commitments/dispute, shift holiday calendar, and leave replacement requirements were removed from forms. Contract and leave files are archived through Documents and their reference is saved on the HR record; detail views expose the saved file. Leave types include configured policies and standard fallbacks, carryover maximum is disabled/cleared when carryover is no, and the leave form is labeled as a definition.
- Appraisal cycle unit, training skill/venue/participant count/average score, and mission approver are optional. Training event date is labeled end date. Mission and independent expense forms expose status. Asset type is labeled name; record-table dates use the Persian calendar.
- Workbench requests addressed to HR appear in the HR inbox through an additive Customer Affairs endpoint scoped to authorized HR recipients. HR surveys can be deleted by an authorized recipient and disappear from the list. Payroll heading is «حقوق و دستمزد».

## Compatibility and ownership

Existing HR record column positions remain stable. New `recruitment.assessment` is additive. Legacy applicant opening relationships remain readable, while new submissions require staffing plans. Documents retains file ownership. Customer Affairs and Workbench Feedback expose narrow, permission-scoped APIs to HR; no direct cross-module table access from HR was added.

## Verification

HR Web 102 tests and HR API 114 tests pass (26 opt-in PostgreSQL tests skipped); final focused API tests 25 pass. Contracts/API/Web typechecks, affected lint and API/Web production builds pass. An opt-in PostgreSQL attempt stopped before test execution because the running local container has no `nora_local` role expected by its harness; no operational data was changed. Exact-head CI remains the integration gate. No authenticated browser QA or runtime rollout is claimed.
