# B2B-DIRECTORY-ACTIONS-001 — PC-B

The owner requests the registration and Excel action bar from the supplied Customers screenshot on the Agencies landing page. The Organizations workspace now uses the same shared Rubi Card and Button components, colors, typography and RTL action order: filtered Excel export, blank import template, Excel import and the primary registration action. At narrow widths the content stacks and the buttons wrap.

The previous header buttons move into this bar below the summary cards. Registration opens the existing four-step cooperation popup; import opens the existing validation/preview dialog. Template download uses the existing Organizations XLSX codec and canonical column headers directly, without adding synthetic rows. The separate sample-data template inside the import dialog remains available. Export keeps the current role/search/status/sort filters and existing authorization. No changes to API, schema, migrations, dependencies, IAM grants or operational data.

## Verification and handoff

- 89 existing Organizations Web tests, Web lint/typecheck, formatting, diff checks and the 40-route production build pass. Actual React browser checks confirm registration and import dialogs, a valid blank template and filtered XLSX export. Final styling verification follows the build.
- Branch `codex/pc-b-b2b-directory-actions` starts from 38203ea, retaining fetched develop e07c0c6 and prior combined runtime changes. Only Organizations workspace and task documentation are changed; Customers source is read-only reference.
- The concurrent LOCAL3100-LATEST-0909 task explicitly handed over Web3100 PID15068 and the temporary API4000 PID16248 for final activation of this newer combined source. Replace only that verified Web process and start the previously verified, source-identical API build on 4190; preserve the database/Documents storage. Stop temporary API4000 only after 4190 is healthy. Do not modify the other checkout. No merge is requested.
