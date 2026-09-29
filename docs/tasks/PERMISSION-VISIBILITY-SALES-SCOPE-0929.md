# PERMISSION-VISIBILITY-SALES-SCOPE-0929 — PC-A

Legacy accounts no longer bypass module visibility. Native operational grants determine their visible groups/screens; authenticated legal-entity baseline read/switch alone reveals no module. Managed profiles require both explicit selected-screen restrictions and an operational grant in the module. Sales creation additionally requires its native create grant. Denied direct routes render no module content or permission warning; server authorization remains authoritative. Session expiry routes to login after refresh fails; network failures stay fail-closed and retry automatically, while access endpoint 403 yields an empty permission set.

Shared Button accepts an explicit native permission and suppresses unauthorized string-link destinations. Sales Excel/PDF/payment buttons use actual API permissions. No operation names are inferred from button labels.

An active role named کارشناس فروش (including legacy sales_staff) narrows inherited contract read.branch/read.all to read.own and update.branch to update.own in IAM effective permissions on every authentication. Sales existing owner/assigned-user and branch restrictions remain authoritative for list, detail, dashboard and exports. An inactive role does not narrow an active manager. مدیر فروش is appended to the title catalog; its proposal includes branch read/update, export/audit and Sales reports within the assigning actor's grant ceiling. Titles alone never grant privileges. Explicit all-scope managers retain their selected grant; the recommendation does not grant global scope.

No schema, migration, dependency, seeded/live grants, tenant scope or runtime 3100 change. IAM produces the effective actor/catalog; shared Web/Sales consume the existing contract shape. Existing title indexes stay stable.

Validation results recorded before handoff in PROJECT_STATUS and WORK_ASSIGNMENTS.
