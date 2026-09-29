# SALES-FIRST-PASSENGER-ACQUAINTANCE-0908

- COMPUTER_ID: PC-A. Base: 8274131. Branch: codex/pc-a-sales-customer-pricing-0907.
- User changed the new-contract workflow: a natural-person customer is always passenger one; no separate customer/payer option. Legal-entity/agency customers remain separate. Add registered acquaintance-method dropdowns to passenger information.

## Delivered

- The shared Customers entry sheet now renders exactly the requested passenger slots in Sales, without an extra primary-customer row or linkage checkbox. Passenger one is directly editable and labelled as customer/first passenger for natural-person contracts.
- New Sales payloads derive natural-person customer ID/name from the first passenger even for older drafts with the optional flag disabled. Agency identity is retained independently, never copied into an empty passenger slot. Mode changes preserve passenger entries; no existing saved contract or customer record is backfilled.
- People save normalizes older separate-payer drafts and creates/reuses passenger one once with customer/passenger roles. The old separate row is retained in draft compatibility metadata rather than overwriting a populated passenger row. Existing recovery, duplicate-identity resolution, passport handling, permissions and optimistic versions remain unchanged.
- Each passenger row has a themed acquaintance-method dropdown loaded across active pages of public Master Data `acquaintance-methods`. Loading, retry and empty states are explicit, without invented options. No free-text method is submitted. Existing saved method IDs remain visible/preserved even if no longer in the active list.
- New selections are sent through the existing Customers public `acquaintanceMethodId` create/update field, not copied into private Sales tables. Updating an existing method uses the current customer version and requires existing edit permission; unchanged/legacy fields are preserved. This addition follows the Customers form's existing optional acquaintance field semantics rather than inventing a mandatory rule for historical customers.
- No Customers/Master Data producer changes, schema, migration, API endpoint, IAM, dependency, real passenger mutation or public push. This is new-contract presentation/payload behavior; legacy saved contract parties are untouched.

## Verification

- 194 Sales Web tests pass: exact row counts, no separate checkbox/row, first-passenger association for legacy drafts, agency separation, saved-draft preservation, create/update acquaintance selection, optimistic version and retry stability, active paginated catalog/error/empty behavior.
- Scoped ESLint and Web typecheck pass. The synthetic browser fixture's explicit partial-record cast was corrected without changing production types.
- Actual-component synthetic Chromium QA passes: two editable rows, no separate payer, agency/person switching without passenger overwrite, catalog retry, both dropdown selections, public create input IDs/roles, first-passenger customer binding and contained mobile scrolling. Screenshot visually inspected; no real data used.
- Production build passes: all 36 Web routes generated successfully on September 8. No migration required.
- Local Web3100 and API4000 health return 200, but Web3100 is owned by the separate customer-direct-contact-0908 worktree (7d11329), which does not include this change. That running process was preserved; this Sales build has not replaced it. Activation needs coordination with that worktree owner, not a blind restart or merge.

## Handoff

Uses existing public Customers entry presentation and mutations plus public Master Data list API. No central schema or producer lock transfer is needed. Existing deployed/printed contracts are not rewritten by this change.
