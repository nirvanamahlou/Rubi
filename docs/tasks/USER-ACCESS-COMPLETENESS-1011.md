# USER-ACCESS-COMPLETENESS-1011 coverage matrix

Source revision at mapping: `68987832643e4f8bac88d8070b798e273ea91411`.
Implementation continues directly by the lead, without Worker Orchestrator, at
the user's explicit request. No additional workers are dispatched.

## Edit-only field controls

| Catalog | Exact control source | Authoritative operations | Enforcement owner | Read behavior |
| --- | --- | --- | --- | --- |
| Master data | `MASTER_DATA_EDITABLE_FIELDS` (46 resources, 357 resource/field pairs) | `POST /master-data/:resource`; `PATCH /master-data/:resource/:id` | `MasterDataService.create/update` | Unchanged; list/detail and sensitive-contact policy remain authoritative |
| Customer ordinary form | `CUSTOMER_EDITABLE_FIELDS` (17 DTO fields; optimistic `version` is not editable data) | `POST /customers`; `PATCH /customers/:id` | `CustomerService.create/update` | Unchanged; sensitive-read permission and reason remain authoritative |
| System settings | `SYSTEM_SETTING_EDITABLE_KEYS` (47 persisted `namespace.key` records) | `POST /system-management/v1/settings` | `SystemManagementService.writeSetting` | Unchanged; settings read permission remains authoritative |

Denied create fields reject any supplied value, including `null`. Denied updates reject
only an actual value change; omitted and unchanged values remain valid. No bulk mutation
entrypoint exists for these three mapped surfaces, so no bulk control is advertised.
Master-data status transitions, currency-rate approval, imports, hotel-rate workflows,
customer contacts/addresses/companions/consents/status, system numbering, feature flags,
templates, notifications and backups retain their existing operation permissions and are
not presented as field controls.

## Additive screen controls

New screen controls inherit an already-authorized parent unless explicitly denied. The
only compatibility repair is the enumerated four document detail tabs and four tour
detail tabs. Correspondence inherits the prior authenticated route behavior and has no
backend send/archive operation. Finance taxpayer-system and tax-accounting controls are
enforced by central route resolution only; accounting-owned source is unchanged.

Existing positive managed-screen behavior remains in force for historical catalog IDs.
All eight dedicated master-data workspaces resolve resource visibility through
`canUseMasterDataResource`. Their historical positive resource flags were not
consumed by those workspaces, so new restrictions inherit the section's actual
legacy visibility rather than requiring previously unused flags. All 46
resource controls use explicit deny overrides. Shared lookup/list/detail APIs
retain their existing domain and sensitive-read checks; the resource override
restricts management UI, mutations and export creation, not shared lookup reads.

Customer-affairs views, corporate-profile tabs and system-setting modules are
filtered at their active UI consumers, including empty and revoked access.
Corporate-profile signatory, framework, rate, profile and credit writes also
enforce their explicit tab restrictions at the API guard. Satisfaction invitation
and corrective-action writes enforce the satisfaction view restriction.
Customer-affairs dashboard and report summary are shared by several views and
retain domain-based read checks rather than denying another permitted view.
Documents preview/audit/share and Reporting view-owned API operations enforce
explicit restrictions. Existing branch and confidentiality policies still apply.
Report metadata/query/preview are shared with saved and shared reports and retain
their domain checks. Restricting the catalog view must not break an allowed
saved-report execution. Read redaction is intentionally not introduced here.

Field checkboxes restrict editing, not disclosure. System-setting controls apply
to the persisted group record, not each nested input. The initial edit catalog
contains 357 master-data field pairs, 17 customer fields and 47 setting records
(421 total); operations not listed above are not advertised as covered fields.

Financial deep routes inherit the old `finance.home` decision. New system module
queries inherit the old `/system` any-authorized-system-screen decision. Neither
requires a new positive grant for an existing user.

## Persistence and delegation

Explicit restrictions are stored as `ui.deny.<control-id>` grants in the target user's
personal access role. Active canonical administrators bypass restrictions. Unknown and
nonassignable grants, inactive and non-personal role memberships, and unchanged branches
are server-owned and survive access-editor saves. Removing a restriction is an access
grant and is accepted only for controls the actor can delegate.
