# B2B-CONTRACT-FORMS-002 — PC-B

Owner request: repair contract and dossier date controls, expand agreement types, select a Master Data payment method, upload each contract/guarantee proof inline into Documents, remove the limit-type control and separate upload section, and close rate reference menus after selection.

## Implementation

- Shared DatePicker has an opt-in dialog host. A native top-layer popover stays within the Radix dialog's DOM/focus boundary, avoids clipping in long forms, and preserves viewport placement in RTL. All Organizations date controls opt in; standalone consumers retain their default behavior. Optional dates can be cleared. ISO day storage and existing date validation are unchanged.
- Agreement types include framework, agency/corporate, flight, hotel, tour, visa, transport, commission, service-level and other cooperation. Incompatible agency/corporate types remain excluded by both UI and API.
- Payment selection consumes the existing Master Data payment-methods reference API. B2B validates active methods through the public MasterOrganizationDirectory and stores a real nullable FK plus a label snapshot on each revision. Settlement semantics PREPAID/CREDIT/MIXED remain separate. New form submissions require the reference; older v1 clients may omit it and preserve an existing reference. No label supplied by a client is trusted.
- Each contract and guarantee contains an inline upload form using Documents options, upload and list contracts. Files are stored by Documents against the same organization and internal cooperation branch; B2B stores only document-version references. Uploading blocks navigation/submission until its result is known. A failed uncertain response is not automatically retried.
- Pending antivirus files can be attached to a draft only. Submit/approve still require CLEAN, active, complete, unexpired documents in the correct organization/branch; infected/quarantined/failed files are always rejected. Other document consumers remain strict by default.
- Removed the separate Documents tab/upload section from commercial terms and the editable credit-limit type. New limits retain HARD; stored SOFT values are preserved. Rate and payment reference single-select lists close after selection and reopen for another choice.

## Validation

- API/Web lint and typecheck, Contracts/Database/API builds passed.
- 109 Web tests (Organizations, date/calendar contracts and reference-field model), 24 workflow/document tests and 18 PostgreSQL integration tests passed. The final wizard payment requirement has seven passing focused tests.
- Browser QA uses actual React/Radix components with isolated API fixtures: Persian contract start 1405/6/20 stores 2026-09-11; Gregorian end selection, guarantee expiry and long-form calendar placement work. Standalone date input stores the same ISO date. Payment and rate reference options close after selection. No staff login/session was fabricated for this QA.
- Real local public-service smoke uploaded two synthetic PNG documents, both CLEAN, and saved a DRAFT HOTEL_SERVICES agreement with the Master Data payment FK and both contract/guarantee version references. No approval/activation was performed. Private report: `C:/Users/admin/Rubi-backups/b2b-contract-forms/smoke.json`.
- Existing date validity/filter mapping and invalid-date validation are covered by the targeted tests. This change repairs existing date controls; it does not add a new date-range query API to tables without one.

## Migration and local handoff

- Additive migration `20260910110000_b2b_contract_payment_reference`; SHA256 `824ee5a6163c40ab2c58174ec0db9fb281083d6c9b966fb7650172dfcca583ff`.
- Rehearsed on a full restored PostgreSQL 18 database. Applied to `rubi_hr_current_20260908` on 2026-09-09 19:06 UTC after backup. Existing data in 129 tables and prior migration history were preserved; the new nullable fields remain null on legacy revisions.
- Backup: `C:/Users/admin/Rubi-backups/b2b-contract-forms/cutover-1788980805197.dump`. Private rehearsal/application reports remain outside Git.
- Branch `codex/pc-b-b2b-contract-forms`, based on 2bdde76 and the prior PR143 stack. API4191 is intentional because Fetch disallows port4190. Existing DB and Documents storage stay in place. Production Web3100 build/cutover and remote checks are recorded below when complete. No merge.
