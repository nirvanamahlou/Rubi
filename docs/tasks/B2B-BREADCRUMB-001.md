# B2B-BREADCRUMB-001 — one working organization breadcrumb

PC-B / `codex/pc-b-b2b-breadcrumb`, based on 92e7a81 from the existing contract/credit work. The owner asked to combine the local organization/contract trail with the global breadcrumb above the page.

The shell now accepts a route-scoped breadcrumb from the mounted dossier. Its hierarchy is workspace, organizations directory, the selected organization and the current section. Parent buttons call the actual directory/overview navigation actions; the current item uses `aria-current="page"`. Returning to the list retains its filters and restores focus to its heading. The duplicate rows inside the directory and dossier have been removed. The shared provider clears the override on unmount and ignores it outside its owning pathname; default HR, Marketing and all other route breadcrumbs remain in place. Wrapping keeps long organization names usable in narrower layouts.

Validation: 137 existing Organizations/navigation/layout tests, Web typecheck and lint passed. The real shell breadcrumb and CorporateProfile were rendered in an isolated browser harness under React StrictMode: entering contracts updates the top trail, the organization parent returns to the 360-degree view, and the directory parent unmounts the dossier and restores the default trail. No operational API or data was used by this browser check. The authenticated local session requires re-login.

No API, migration, dependency, IAM grant, business-data or other module behavior changes. Runtime activation and final build evidence are recorded in the final status entry; preserve the existing API4190/database/Documents configuration when refreshing Web3100.
