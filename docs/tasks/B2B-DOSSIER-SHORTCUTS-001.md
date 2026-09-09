# B2B-DOSSIER-SHORTCUTS-001 — PC-B

Removed the registration shortcut row circled in Screenshot532 from the shared agency/corporate 360 home page, including its empty panel heading. Summary information, metrics and six section cards remain. The unified profile cards and popup forms remain accessible through Organization dossier; other sections keep their existing navigation.

Presentation-only change in `corporate-profile.tsx`. No data, API, IAM, migration or dependency changes. Branch `codex/pc-b-b2b-remove-dossier-shortcuts` starts from 82f003c and retains the combined runtime and PR141 dependencies. Review targets develop; no merge.

Existing 90 Organizations tests, formatting, full Web lint and typecheck pass. Actual React browser fixture verifies the shortcut panel is absent and the six section cards remain; profile navigation still works and the console has no errors. Final build and local runtime results are recorded after cutover.

## Completed cutover

- Source e1f8d3ef8ed9d74a44e3c9d26eee2507ca95ea83 is active on Web3100 PID22988 / hr005-32d45f524f9da7a2. All 40 routes build successfully; organizations returns HTTP200 and the runtime endpoint matches. API4190 PID16408 was not restarted and its health endpoint returns ok. Existing database/storage are unchanged.
- All four CI gates in run34456782273 pass. Draft PR142: https://github.com/nirvanamahlou/Rubi/pull/142. No merge. Implementation lock released. Documentation-only follow-up does not change the built source.
- Browser visual verification used the real React component with isolated fixture data; the operational browser requires login. The fixture was stopped and the browser returned to localhost3100 after verification.
