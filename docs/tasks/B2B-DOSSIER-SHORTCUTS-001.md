# B2B-DOSSIER-SHORTCUTS-001 — PC-B

Removed the registration shortcut row circled in Screenshot532 from the shared agency/corporate 360 home page, including its empty panel heading. Summary information, metrics and six section cards remain. The unified profile cards and popup forms remain accessible through Organization dossier; other sections keep their existing navigation.

Presentation-only change in `corporate-profile.tsx`. No data, API, IAM, migration or dependency changes. Branch `codex/pc-b-b2b-remove-dossier-shortcuts` starts from 82f003c and retains the combined runtime and PR141 dependencies. Review targets develop; no merge.

Existing 90 Organizations tests and formatting pass. Actual React browser fixture verifies the shortcut panel is absent and the six section cards remain; profile navigation still works. Final quality/build and local runtime results are recorded after cutover.
