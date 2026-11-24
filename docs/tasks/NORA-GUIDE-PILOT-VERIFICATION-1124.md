# Nora guide pilot verification — 2026-11-24

- Isolated Chrome exercised the actual guidance HTTP handler and the repository's route permission function against a synthetic IAM HTTP service. The selected website and operational ERP were untouched.
- Endpoint checks passed for S01, S02, S04, S06, I01–I06 and C01–C06. These verify routing, section IDs and role-filtered references. C04 verifies that a live-record question bypasses procedural guidance.
- S03 is exercised by the contract-form component helper's live validation tests. S05 is exercised by Composer account/company isolation tests. Neither was exercised in the authenticated ERP browser.
- 602 Assistant Web tests passed in 41 suites using an isolated workspace configuration resolving the contracts package to source. Catalogue consistency passed.
- Remaining release gate: run all 18 scenarios through the actual authenticated ERP preview, with native IAM and test accounts. Synthetic IAM and component evidence do not certify that environment.

## Native IAM preview

- The pilot Web ran on a local Next preview. It used the native ERP IAM API with a separate PostgreSQL instance, all 270 migrations, and synthetic Sales, Reservations, Finance and Customer Affairs accounts. The IAM build was from the existing local acceptance worktree.
- The Next guidance endpoint passed the 16 baseline routing and scope checks with native sessions. A mismatched loopback Origin returned 403. Chrome used the matching localhost Origin.
- Chrome confirmed conversational rendering for contract creation, the pre-handoff checklist, receipt upload, ticket issuance, vouchers, the role-filtered issuance reference, the unsupported reissuance response and finance delivery guidance. The real incomplete contract form supplied the error shown by Nora (S03).
- The customer-status question initially reached an unavailable provider. The pilot now asks for the tracking number and shows where to check the current assignee. Chrome verified that reply and the clarification for ambiguous follow-up (C04, C06). For S05, Chrome confirmed the previous selected contract ID was used before the switch and was absent from outgoing assistant requests after switching native accounts. A synthetic DOM selection fixture supplied the ID.
- No production components were changed.
