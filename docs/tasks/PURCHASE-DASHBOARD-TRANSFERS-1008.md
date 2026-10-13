# PURCHASE-DASHBOARD-TRANSFERS-1008

PC-A; user authorizes implementation and develop merge. Base: origin/develop d81cf611.

Purchase hub defaults to UNREGISTERED unless a valid ALL/REGISTERED bookmark explicitly overrides it. Existing category, search and date filtering/sorting remain. A service purchase dashboard displays total, unregistered, registered and unknown counts for the authorized category/search/date scope, independent of status and pagination. Unknown flight purchase state remains unknown when the actor cannot read flight purchase facts.

Reservations purchase inbox version1 adds optional meta.summary and per-row coveredServiceClientKeys. Producer Reservations and Web consumer ship together; old response consumers ignore additive fields and the new Web does not invent totals for older responses. No shared wire command, table or permission changes. Aggregation and grouping use only branch-scoped Reservations tables plus the existing authorized public Finance flight projection. No operational data write or local rollout.

Unregistered transfer directions of one intake are a combined work item. Effective latest purchases sharing the same multi-key revision also appear once; independent revisions stay separate. Grouping precedes global sorting/pagination and dashboard aggregation. The display title is changed on a copied service descriptor, preserving canonical snapshot titles and all covered keys.

The purchase editor retains the existing separate-broker checkbox and atomic batch command. Splitting preserves supplier/currency defaults and independent saved drafts while per-leg prices remain explicit. Latest transfer restoration resolves effective per-key revisions so an older combined revision cannot hide newer split purchases. Rejoining returns to the preserved combined draft; server CAS, idempotency, pricing arithmetic and Finance payment lifecycle remain unchanged.

Verification:32 Web tests (including English coverage and combined-to-split-to-combined batch payloads),34 API focused tests and8 temporary PostgreSQL query tests passed. PostgreSQL fixtures verify grouped fresh pairs, shared revisions, independently purchased legs overriding an old common purchase, status/date/branch bounds, pagination and dashboard totals. Tables are temporary inside rolled-back transactions; no operational fixture was persisted. Scoped lint and final typecheck/build/CI results are recorded in the PR. No migration or dependency change.
