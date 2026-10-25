# Employee case workflows — 2026-10-25

COMPUTER_ID=PC-B. Owner explicitly requests employee-centred summary/edit and optional job changes, exit, leave and contracts, removing the standalone lifecycle/contracts sections and time leave group.

- Employee summary/edit retains existing identity/contact confidentiality and the shared personnel editor. Optional workflows never become prerequisites for employee creation or editing.
- Job changes reuse lifecycle promotion/transfer; exit reuses separation, exit interview, settlement, contract termination and read-only finance follow-up. Contracts reuse active/amendments. Leave reuses time leave and the read-only minute cardex; global transfer rules stay in time settings.
- Canonical resource identities, historical records and backend approval/application rules remain intact. No tables, records or APIs are deleted. Legacy entry URLs preserve the desired tab when selecting an employee.
- Every new/edit profile form carries the selected employee ID. Its company selector is locked to avoid resetting the locked employee. Existing parent filtering continues to restrict employee-owned contract/separation parents to that employee.
- Position field labels/placeholders and displayed dataset/detail columns use job-title wording; canonical serialized positions and keys are unchanged. Existing shared job-title options remain the source.
- Profile workflow reads retain complete authorized pagination and keyed pending/error/retry behavior. Existing view permissions and read-only resource rules remain enforced after relocation.
- Report/source discovery includes moved resources, preserving leave/cardex reports and record details.

Validation: existing HR regression inventory plus focused profile form-target, revision identity, optional entry, viewer permission, source permission, routing and job-title catalogue checks. Full quality/type/test/build/database gates must pass before the explicitly authorized normal develop merge. No schema, dependency, deployment or Radan mutations.
