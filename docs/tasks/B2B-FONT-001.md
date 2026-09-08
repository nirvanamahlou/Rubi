# B2B-FONT-001 — inherit Rubi's shared font

PC-B / `codex/pc-b-b2b-font-alignment`, based on the combined local runtime branch at `2c434c1`.

The owner requested the Agencies/Organizations section to use the same font as the rest of Rubi. Browser inspection confirmed the body uses `"Vazirmatn Variable", Tahoma, Arial, sans-serif`, while the section, title and create button used `Tahoma, "Segoe UI", sans-serif`. Removing the single module-specific `font-family` declaration in `corporate-design.css` makes the directory, agency/corporate dossier and portal-based dialogs inherit the shared global font. Font loading, sizes, weights, layout and all application behavior remain unchanged.

Validation: all 87 existing Organizations Web tests and the production build (40 routes) passed. No additional implementation-mirroring test is added for this CSS inheritance change. Final Web lint/typecheck and authenticated browser checks gate activation. Refresh only the owned Web3100 listener; API4190, HR, database, Documents storage, credentials and permissions remain untouched. No migration or dependency change.

Runtime/font evidence is kept outside Git in `C:/Users/admin/Rubi-backups/b2b-font-runtime.json`. Record the exact built source and computed font on the directory, dossier and popup after activation; later documentation commits may follow the built source commit. Coordinate future shared-runtime changes with this task.
