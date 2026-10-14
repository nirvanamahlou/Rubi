# Sales seller visibility

The owner explicitly requests on 2026-10-14 that active Manager and Sales Manager
profiles can read contracts across the system and create contracts. Sales Experts
can read only their own contracts, not another seller's assigned contracts. This
bounded policy applies to authenticated effective permissions, including a valid
manual profile; disabled, malformed or multiple manual snapshots still fail closed.
Other grants and screen/field restrictions remain unchanged. No IAM records are
modified by this implementation.

Sales list, detail, dashboard, receivables and Excel use consistent owner-only scope.
The seller name is resolved through the IAM public directory after row authorization.
Optional summary fields preserve compatibility for older consumers. Web shows the
seller column and a yellow marker for a canonical reservation amendment or an
operational form correction explicitly applied to the contract. Internal-only form
edits create neither marker nor new form details in the Sales list.

All existing job titles, including Sales Manager, are shown in the user-creation
selector rather than limiting it to five visible options. The Sales Manager access
proposal includes system-wide read and creation; contract editing remains scoped to
authorized branches. All sellers continue to use the common Reservations intake.

No migration, dependency change, operational data change or runtime activation.
Validation and CI are pending; the user authorizes merge to develop after checks.
