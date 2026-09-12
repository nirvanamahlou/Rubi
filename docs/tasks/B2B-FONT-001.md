# B2B-FONT-001 — inherit Rubi's shared font

PC-B / `codex/pc-b-b2b-font-alignment`, based on the combined local runtime branch at `2c434c1`.

The owner requested the Agencies/Organizations section to use the same font as the rest of Rubi. Browser inspection confirmed the body uses `"Vazirmatn Variable", Tahoma, Arial, sans-serif`, while the section, title and create button used `Tahoma, "Segoe UI", sans-serif`. Removing the single module-specific `font-family` declaration in `corporate-design.css` makes the directory, agency/corporate dossier and portal-based dialogs inherit the shared global font. Font loading, sizes, weights, layout and all application behavior remain unchanged.

Validation: all 87 existing Organizations Web tests, Web lint/typecheck, formatting and the production build (40 routes) passed. No additional implementation-mirroring test was added for this CSS inheritance change. Authenticated browser checks confirm the directory, table, dossier headings and every sampled popup title/button/input/select use the same `"Vazirmatn Variable", Tahoma, Arial, sans-serif` family as the body, and the font is loaded. The wide popup was visually checked at 1280px. No business form was submitted.

Only Web3100 was restarted: PID2104, built source `da1ed411f67068215192f91be94fb3a15ee7cfdb`, fingerprint `hr005-1ee6260df8850097`. API4190 PID18812 remained running and health200; HR, database, Documents storage, credentials and permissions are unchanged. No migration or dependency change. Runtime/font evidence is kept outside Git in `C:/Users/admin/Rubi-backups/b2b-font-runtime.json`; later documentation commits do not change the built source. Implementation reservation is released; coordinate future shared-runtime changes with this task.
