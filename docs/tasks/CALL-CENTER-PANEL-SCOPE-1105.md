## CALL-CENTER-PANEL-SCOPE-1105 — PC-C — CANDIDATE

User explicitly corrects the prior design scope: the shared sidebar, header and application shell must keep their normal appearance when Call Center is selected. Remove its route-dependent shell palette/icon substitutions; keep the illustrated Navy/Pearl palette on the Call Center workspace and its dossier portal only. Preserve navigation, permissions, history-icon updates, pagination and all operational data behavior. Source starts from develop de9729ea2.

Independent scope review and one boundary regression cover normal shared navigation and panel-only light/dark styling, including the portal. Full affected checks and final-head hosted gates are required before the user-authorized merge/release. The Web-only bounded release preserves live peer overlays, handles deletion of exactly three obsolete appearance files, verifies an encrypted server backup and canary, and checks assets, Worker/AMI/recording health with rollback. No schema, migrations, dependencies or grants.

