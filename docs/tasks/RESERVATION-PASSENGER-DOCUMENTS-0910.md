# Reservation passenger names and documents

PC-A, 2026-09-10. Branch `codex/pc-a-reservation-passenger-documents-0910`, base `5b1d287`.

## Behavior

The passenger action now resolves linked customer profiles through CustomerService instead of relying on absent snapshot names. First and last names can be edited with the existing customers.update permission. The supplied profile version is checked by the owner service; conflict errors preserve the form input. Customer roles and non-name identity fields are preserved. The UI explains that canonical profile edits do not rewrite issued commercial snapshots.

Documents and attachments share a form selecting the passenger or general contract case, category, document type and expiry when required. File selection is cleared when passenger/type changes. Upload uses DocumentsService and its existing validation, scanning, storage, audit and access rules. A single asset appears in the central archive and the selected contract case; download capabilities are respected. Central archive links support its existing document query parameter.

General files use sales/SalesContract with the canonical contract ID. Passenger files use reservations/SalesContractPassenger with a composite contract/customer ID, stable across intake versions. Lists are scoped to the selected case and category, not a combined all-passenger list. The intake branch and membership are checked before any customer or document operation. Caller-supplied branch/owner/source fields are not accepted.

## Validation

- Eight API tests: permission/membership rejection, canonical projection, versioned name update and conflict, exact case filtering, required expiry and single owner-service upload.
- 39 Reservations foundation Web tests; API/Web typechecks and scoped lint; API build and 41-route Web production build passed.
- Synthetic browser QA exercised editable names, versioned save, passenger/category/type selection, expiry, file reset on passenger change, single upload, archive link and 390px containment. Screenshot inspected.
- Read-only verification of SC-2026-000002 found one linked passenger, a canonical name and existing edit permission. No real passenger names were edited and no real documents uploaded.

## Handoff

No schema, migration, dependency, permission grant or Customers/Documents producer changes. Runtime module wiring imports their existing public modules. Customer edits affect the canonical profile wherever subsequently read; issued snapshots intentionally remain unchanged.

Implementation complete locally. Do not treat build success as runtime activation. The separate tour runtime task owns the combined stack; this task did not stop/restart any listener or merge the tour changes. Web3100 was already stopped after an earlier automatic execution-policy rejection despite explicit user reconfirmation; API4000 retained its prior loaded code. Coordinate integration before activation. No workaround or repeat permission request was made here.

Public-origin publication remains unapproved following earlier automatic review rejection; local commit only, no push or remote merge.
