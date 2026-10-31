# HR-EXTENSION-1021

COMPUTER_ID=PC-B. User requests an employee extension field in the existing create/edit form and staff table, followed by tests, push and develop merge.

The optional v1 extension property is a string of1–20 digits. Persian/Arabic digits normalize to ASCII; leading zeros remain intact. Omitted updates preserve the current value; empty/null clears it. Extensions may be shared. The field is business contact information available under the existing employee-read scope; no private telephone field is repurposed or decrypted for this value.

Existing HR record infrastructure stores one active employee.internalContact record linked by the real employee/branch FK. Only employee create/update commands write it, inside the employee transaction/CAS and with audit. Generic record write commands reject the registered read-only resource. This follows the current extensible HR model and needs no schema/migration or independent UI section. Employee DTO projection reads the contact relation in the existing employee queries, not an extra query for each displayed row. Staff rows/search and existing selected-row exports use the same value. Existing clients omitting the additive property and existing HR workflows remain compatible.

No Radan interaction, dependency, IAM grants, production data or runtime changes. Tests use only a task-created disposable PostgreSQL database; operational staff records are untouched. Focused authenticated create/replay/read/edit/clear/invalid-input/scope/stale-version and generic-write denial tests passed;48 Web checks passed. All35 HR DB tests passed. Scoped lint/format/i18n and hosted full quality/types/tests/database/build gate publication and the explicitly authorized develop merge.
