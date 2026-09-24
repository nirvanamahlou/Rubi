# B2B-DOSSIER-SALES-REMOVAL-001 — PC-B

The owner requests removal of Sales Operations from the 360 dossier. Removed its shared section definition in `apps/web/src/modules/organizations/components/corporate-profile.tsx`, which removes the card and the travelers, sales-contracts and orders/reservations subpage navigation for both agency and corporate dossiers. The remaining six sections and their working breadcrumbs retain their existing behavior.

This changes presentation only. There is no Sales API/data deletion, permission change, dependency or migration. Existing financial/order summary indicators remain as before. No persisted Sales route needs migration: dossier section navigation is local component state.

## Verification and handoff

- All 89 existing Organizations Web tests, Web lint/typecheck, scoped formatting, diff checks and the 40-route production build pass. All four GitHub push gates pass for source 4d49975 (run 34367870898).
- Actual React component browser verification confirms six cards, absence of Sales Operations and its subpages, navigation to Finance and back, and no browser errors. This used the existing isolated public-client fixture harness; the production browser session remains at login. The temporary harness was stopped afterward.
- Branch `codex/pc-b-b2b-remove-sales-section` starts from clean 3bb9fe1 and preserves the combined local runtime history, including fetched develop e07c0c6. No merge is performed.
- Web3100 PID3644 serves source 4d49975 / hr005-3d2484aaec769e16 and its runtime endpoint matches. API4190 PID14320 remains healthy; its existing database/Documents storage and the previously granted dossier permissions are unchanged. Documentation follow-up commits do not alter the built source.
- Other computers can fetch the published branch to review this 13-line presentation removal, preserving preceding B2B PR132–135 dependencies. No local data administration needs replaying for this UI change.
