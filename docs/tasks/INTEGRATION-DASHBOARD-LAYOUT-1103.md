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
Typecheck, full production build, live modal/selector checks and exact-head hosted
gates remain publication acceptance. Existing production Web source is a newer
mobile overlay and must be preserved outside the reserved files; API/Worker and
all other services remain unchanged.
