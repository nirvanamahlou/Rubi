# ROLE-ACCESS-PRESETS-0929

PC-A; branch `codex/pc-a-role-access-presets-0929`; latest develop baseline. User explicitly clarified that suggestions follow the selected job role, with confirmation or customization. Previous feature merge/local activation authorization continues for this refinement.

## Behavior

New account forms and job-title changes show a recommendation panel listing visible sections and native operation grants. Choosing a title alone never overwrites grants. Confirm applies the proposal to form state; customize applies it and focuses the existing checkbox editor. Keep-current preserves previous choices. Pending proposals disable final save until one choice is made. Opening an existing account preserves its saved grants; a separate button previews the role's recommendation again. Applying replaces section/action selections but never branch scopes. Final account persistence still uses the existing explicit save and IAM authorization.

Recommendations use the actual IAM permission codes from permission-seed-data and existing role seed definitions, with explicit role-specific differences:

- Manager: all operator-assignable screens/actions.
- Sales expert: customers, own-contract creation/update, sales payments, reservation request and read/quote pricing.
- Finance: financial read/payment entry; finance manager adds accounts, approvals/releases and financial reports.
- Reservation employee: travel read, arrangements and documents; reservation manager adds ticket management, hotel purchase and travel reports.
- Support: customer read, leads and support tickets.
- HR: routine HR read/manage; approval and sensitive grants remain custom choices.
- AI team: read-only analytical reports; export/share/operational writes remain custom choices.
- Visa team: passenger identity/travel documents, without finance/purchase changes.

All suggested native grants intersect the authenticated operator's grants and access-options. Suggested screens intersect their screen visibility. Unknown roles receive no default grants. No API, shared contract, schema, migration or dependency changes; no real account is created/edited by this task. Existing last-administrator protection remains server-authoritative. Recommendation policy is an editable UI starting point, not a second authorization system. Synthetic tests cover role coverage, approval separation, own-vs-all scope, restricted operators, unknown roles, option immutability and explicit confirmation controls. Authenticated browser QA is not claimed because browser attachment was unavailable in the preceding UI task.

## Validation

32 focused Web tests passed; strict Web typecheck and scoped lint checked. Production Web build and full CI checked before integration. Bounded UI/docs locks release with scoped commit.
