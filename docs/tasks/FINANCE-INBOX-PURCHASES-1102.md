# FINANCE-INBOX-PURCHASES-1102

PC-A; `codex/pc-a-finance-inbox-purchases-1102`, develop `8220d4e5d`.
Owner requests account-or-supplier payments, one purchase-rate input per currency,
complete Reservations purchases, purchase/receipt filters and develop merge.

Purchase payments now explicitly select an active same-currency branch account
or a validated paying supplier, with exactly one source. The existing payment
method, rate, partial-payment, version, idempotency and audit flows remain.
Only Reservations supplier payments, ticket purchases and invoice payments opt
into this policy. Account-only and supplier-for-foreign policies used by other
operations remain unchanged; no Accounting/partner-dossier implementation changes.

Pending FX capture controls group the selected request's rows by currency. One
manual input submits optional `referenceIds` with the existing
`POST /finance/purchase-fx/:id` command. Omitted IDs retain the old single-source
response. Every source must belong to the same authorized request and currency;
UUID validation, bounded arrays, stable lock order and one transaction protect
the group. Each immutable snapshot retains its own amount and source FK. Existing
recorded rates are neither overwritten nor re-requested by the grouped control.
The actual payment-date conversion rate remains an independent payment fact.

The missing-purchase cause was confirmed through code and read-only production
aggregate counts: Finance consumed the default 100-row Reservations UI page.
Its contract deduplication also hid a purchase-bearing older intake when a new
operational intake was received. Reservations now exposes `listForFinance`, a
branch-scoped purchase-only read projection across intake revisions. Existing
per-service purchase revision selection remains owned by Reservations. Finance
continues to exclude fully paid groups from actionable requests. Financial
history is preserved; no payable or payment is fabricated. A 10,000-intake guard
fails explicitly rather than returning an incomplete balance. Compatible older
adapters are fully paged with duplicate-page detection.

The additive optional v1 `category` query is `PURCHASE` or `RECEIPT`.
Purchases include Reservations and Procurement payment requests; receipt
verification uses its existing request kind. Other filters intersect normally
before totals and pagination. Export queries and personal view storage carry
the same filter; old queries are unchanged.

Validation:111 focused API checks across source selection, purchase visibility,
pagination/history, group FX authorization/transaction/conflicts, invoice/ticket/
supplier payment regressions, filters and follow-ups;19 Web/client/translation
checks. Scoped lint, Contracts build, API/Web typechecks, API production build
and 67-route Web production build pass. Local Web uses webpack because Windows
dependency junctions cross Turbopack's filesystem root; no application config
change. All required final-head hosted gates precede owner-authorized merge.

No schema, migration, dependency, production payment, operational data rewrite
or deployment. Fetch the merged develop before further changes to these scopes.
