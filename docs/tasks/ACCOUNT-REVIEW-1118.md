
# ACCOUNT-REVIEW-1118 — PC-D

The account browser in Nora uses the current company's authorized ledger and fiscal period. A result can be opened as movements or used as a constraint for another dimension. The report carries the selected path, filters and page in the URL. Scope from another company or active year is discarded when the company or year changes.

## Read-only reference observations

- Rahkaran exposes group, general, subsidiary, levels four through six, currency, tracking, and all-level detail. Choosing a row makes scoped breakdowns into other dimensions available. The type-based view exposes the types used by the ledger and optionally displays the classification number.
- Document scope supports date, month, or document number; account type, detail type, multiple voucher types and statuses, and nonzero balances.
- Opening movements goes from a summary result to journal rows. Opening a journal row displays the corresponding document and highlights that row. Tracking groups by number and date. Currency displays separate base and foreign amounts.
- The reference “Analysis” workspace exposed matching and removal commands. These were inspected visually as a separate workflow. It and issuing statements are outside this read-only report. No records were changed or copied from the reference.

## Nora behavior

- Use the nine review dimensions, a detail-type summary and a specific detail type for breakdown. Selections apply as intersections against actual book-scoped journal lines. A detail occurring in two slots is counted once in an all-level detail or type bucket. A line can belong to multiple different detail buckets, so adding those buckets does not represent a ledger total.
- Posted journals are included by default. The status filter can explicitly include draft, pending or approved journals. Date and Persian month ranges use the selected fiscal allocation. Document number and total debit filters apply to whole journals. A journal amount is tested before restricting the included accounts.
- Opening balances come from earlier lines in the same fiscal period. Debit, credit and balances are computed with PostgreSQL numeric precision. Running balance uses a stable chronological order before pagination and line search. A repeated tracking number on different dates opens only the selected date. Currency reports separate foreign amounts by currency.
- The document view uses the existing authorized journal reader and highlights the selected article. Report and document navigation is read-only.
- Excel export runs the same query with explicit finance export permission and caps the result at 5,000 rows, requiring a narrower range above the cap. Print output covers the current page. Identifiers and decimal values export as exact strings.
- No schema changes or migration. Company and active-fiscal-year authorization remain enforced. Link back and user-facing content follow Nora's own interface.

## Validation

Six isolated PostgreSQL tests verify the full axis intersection, type deduplication, tracking by date, running balance across pages, same-scope export, and company, fiscal period and permission controls. The Accounting regression suite and targeted Web tests exercise the report and related routes. Operational databases were left untouched.
