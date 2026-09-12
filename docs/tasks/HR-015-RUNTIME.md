# HR-015 — Web runtime panel removal

PC-B; user-authorized activation of the UI-only removal already merged in PR226.

CA owner handed off Web3100 after b1da23bd. Isolated branch codex/pc-b-hr-panel-runtime-0913 preserves that complete baseline. Only the AppShell outlet, HR referral link and unreachable standalone frontend files are removed. The visibility context, backend connection services, contracts, records and normal form references remain. API4190 stays on the CA checkout; no restart, database write, migration or permission change is included.

Validation and runtime identity will be recorded after completion. The CA API connection interruption documented by the owner remains outside this UI-only change.

Validation: Web lint, standalone typecheck, 306 existing tests across 50 HR/Organizations/layout/CA files and production build (46 routes) passed. API/contracts/database/lockfile diff is empty. Runtime cutover pending.
