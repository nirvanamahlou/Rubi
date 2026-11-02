# GHESTIROO-SITE-MAP-1102 — PC-D

Correct the site-owned public navigation map and browser classification together.
Keep main page families, group related detail pages, separate train/bus/visa and
destinations, show actual Home navigation and actual booking links. Do not invent
cart pages or observed conversion/funnel flows. Links describe available site
navigation; live numbers describe current visible browsers, not transitions.

Producer: Ghestiroo canonical JSON manifest for nodes, groups, routes and edges;
tracker and Python presence read the same source. Consumer: optional mapKind,
groups/node grouping/edge metadata in Nora Integrations only. Old producers keep
their existing map. No URL, query value, personal identifier or business data is
sent by the tracker. Preserve anonymous ID hashing,90-second expiry, unknown
legacy-bucket total accounting and worker-thread database handling.

Publish producer before consumer, preserve rolling compatibility, no migration,
dependency or unrelated source/runtime changes. Nora requires final-head CI;
Ghestiroo CI tests remain cancelled under the owner's standing task instruction.

Owner chose the complete grouped view with moderate detail.17 families cover all
normal public page routes; experimental preview routes remain Other. Actual
selection/checkout links are source-reviewed (visa goes to request tracking,
flights/trains to passenger entry, tour/hotel/bus to checkout). Home entry and
return navigation are explicit. Cards reveal incoming/outgoing relationships on
selection. Other producers retain their original renderer. Tests cover the real
page-file inventory, train/bus separation, grouped detail pages, Home links,
legacy count conservation, metadata validation and original-map compatibility.
