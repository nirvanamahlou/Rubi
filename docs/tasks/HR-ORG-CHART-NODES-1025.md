# HR organization chart nodes — PC-B

Owner-authorized scope: add department/employee nodes, per-node toolbar, persisted drag positioning, edit/delete, tests, push and develop merge. Existing HR theme/panels remain. No Radan writes or deployment.

## Data contract

- `organization.units` continues to own actual departments. Add directly through its existing create form, with selected parent/company prefilled; edit the canonical record.
- Additive `organization.chartEmployees` has `employeeId` FK, optional same-branch `parentId` FK to a unit or another chart employee, canonical employee name and optional display title. One current-company/branch chart node per employee is enforced inside the existing serializable command transaction. Diagram membership does not replace the employee assignment or manager workflow. Prior transfer nodes remain historical records and are excluded from the live projection; they do not block the employee from being attached in their new company.
- `HrWorkflowData.chartX/chartY` are optional finite CSS-pixel offsets between -5000 and5000, accepted only for organization branch/unit/employee nodes. They use existing JSON persistence, version/CAS and audit. No migration or new dependency.
- Parents must be authorized, active, same branch/company and acyclic. Company changes inspect both unit and employee descendants. Existing children block deletion until reparented; no hidden cascade. Deleting an employee chart record preserves personnel and assignment history.
- Client drags update live connectors; pointer cancellation and failed saves restore authoritative offsets. Keyboard arrow movement is available through the same move handle. All mutations are hidden for readers and disabled during position save. System IAM roots remain immutable; their add-child actions still target valid branch/company forms.

## Verification

Initial40 isolated real PostgreSQL/HTTP checks pass, including persistent coordinates, stale-version rejection, scope, cycle and duplicate-node guards and safe deletion.153 HR Web checks across29 files pass, including node projection, sidebar controls, immutable roots, actual form targets and legacy preview compatibility. Three focused backend validation checks pass. Final source checks and exact-head hosted quality/types/full tests/production-build/database gates precede the authorized develop merge.
