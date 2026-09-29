# FINANCE-HISTORY-SEAT-PRICING-0928

Owner: PC-A. User authorizes implementation and develop merge.

Requests with an existing invoice now retain a separate seat/unit-price editor before the first payment. Seat count and unit cost appear in both inbox cards and details; the existing exact decimal calculation and server-side invoice calculation remain authoritative. Pricing stays immutable once payment begins.

GET /finance/transaction-history is an additive authenticated finance.read projection, independent of pending requests. Ticket, procurement invoice and Reservations payment revisions retain each structured installment, including fully settled requests. Sales exposes confirmed receipts through its public service/repository. Reservations exposes branch-scoped immutable purchase descriptors (including replaced purchases), and Finance queries only its own evidence tables. Account titles are read from Finance-owned accounts; only existing method labels are exposed. No account/card numbers are returned.

The response is version 1, 25 entries per page, ordered by UTC occurrence date/source/id. An opaque validated cursor retains equal-date records. Direction/source/request filters are validated and branch scope is always enforced. Producer/database errors are surfaced instead of silently claiming an empty history. Receipt dates mean Finance confirmation time; outgoing dates use the recorded transfer date. Rows show installment amount, account/method/reference, cumulative amount and remaining amount. The bottom history panel supports receive/pay filtering and older pages; ticket and Reservations request details show their own history. Finance actions refresh mounted history panels.

No migration, dependency or operational data change. Legacy supplier revisions without a recorded amount/transfer date are not invented as structured installments. Old ticket invoice totals remain editable into seat pricing before payment; historical paid invoice prices are preserved.

Validation: 23 targeted API and 29 Web tests, API/Web strict typechecks, scoped lint and production builds (53 routes) passed. Authenticated interactive browser validation is not claimed.
