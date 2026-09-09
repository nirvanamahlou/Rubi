# B2B-DOSSIER-SALES-REMOVAL-001 — PC-B

The owner requests removal of Sales Operations from the 360 dossier. Removed its shared section definition in `apps/web/src/modules/organizations/components/corporate-profile.tsx`, which removes the card and the travelers, sales-contracts and orders/reservations subpage navigation for both agency and corporate dossiers. The remaining six sections and their working breadcrumbs retain their existing behavior.

This changes presentation only. There is no Sales API/data deletion, permission change, dependency or migration. Existing financial/order summary indicators remain as before. No persisted Sales route needs migration: dossier section navigation is local component state.

## Verification and handoff

- All 89 existing Organizations Web tests, Web lint/typecheck, scoped formatting and diff checks pass. Production build and component browser verification are in progress.
- Branch `codex/pc-b-b2b-remove-sales-section` starts from clean 3bb9fe1 and preserves the combined local runtime history, including fetched develop e07c0c6. No merge is performed.
- Refresh only the owned Web3100 runtime after building; API4190, its existing database/Documents storage and the previously granted dossier permissions are unchanged.
