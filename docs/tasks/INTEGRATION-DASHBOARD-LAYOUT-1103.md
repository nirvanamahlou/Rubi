# INTEGRATION-DASHBOARD-LAYOUT-1103 — PC-D

Implement all11 owner browser comments on the Integrations dashboard. Four KPI
cards summarize the selected period across listed sites, independent of the
site selected for trends or live tracking. Counts remain per-site facts summed
across sources, without cross-site identity deduplication. Unavailable sources
must not become zero or a claimed complete four-site total. Sales preserve exact
decimal strings and separate currency buckets without invented conversions.

Keep the existing per-site catalogue cards. Show four compact visit summaries
side by side on desktop, with per-site measured/unavailable states and historical
coverage in expandable details. A small tracking launcher contains site selection
and opens an accessible dialog with site switching, refresh and close controls.
Keep the actual navigation map and short-lived source presence protocol.
Trend has its own site selector; period changes invalidate all stale reports and
drills. KPI detail modal compares contributing sources and allows per-site paging.

Remove selected-site KPI heading, explanatory paragraphs/definition block,
operational readiness/queue panel, ERP flow, activity feed and duplicate comparison
from the first page. Preserve native site management and other Integrations views.
No producer/API, IAM, schema, migration or dependency changes.

Validation:61 Integrations/English checks pass, including9 new meaningful
regressions: all four source contributions (including education), exact amounts
above JS integer precision, separate currencies, missing/forbidden/error sources,
stale period/binding rejection, incomplete source money, duplicate IDs, large count
sums, recorded-zero semantics and compact/removed-panel markup. Scoped lint passes.
Local Web typecheck passed after rebuilding stale generated Contracts output,
without changing Contracts source. All8 hosted checks passed on18d378b6b. Full
server Web typecheck/build and live owner-session acceptance passed. Today returns
zero new orders/accounts/pending cases versus1/3/1 over30 days; all source facts
are read from the chosen period. Switching trend sites leaves global KPIs
unchanged. Detail sources and automatic3-account drill, tracking site switch,
refresh, close/unmount and four aligned desktop visit cards all verified. No
browser errors or desktop horizontal overflow; temporary viewport restored.

Runtime changed during staging because another approved Dashboard overlay was
published. Rebuilt on that current image under the common deployment lock,
preserving1847 outside-scope Web files, existing Dashboard changes, translations,
API/Worker and all other services, environments and mounts. Two initial staging
builds hit host OOM; full checks subsequently passed using bounded memory and1GiB
temporary swap, removed after completion. No type/build gate was skipped and no
permanent server setting changed. Runtime source18d378b6b remains byte-equivalent
to the final reviewed source; later merge only updates unrelated upstream and
task documentation. Final-head hosted8 checks precede PR1344 develop merge.

Current production coverage is1of4 configured catalogue sites: only Ghestiroo
supplies valid reports. Its partial source coverage is shown on each KPI; the
remaining sites stay unavailable rather than becoming measured zero. Four-source
sum correctness, including education, is independently covered by fixtures.
