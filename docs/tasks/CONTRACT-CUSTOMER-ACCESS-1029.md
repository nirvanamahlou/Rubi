# Contract person registration recovery

Owner: PC-A. Branch: `codex/pc-a-contract-customer-access-1029`.

The new-contract workflow already uses Customer's bounded `/sales/people`
producer and request-local capabilities for authorized contract creators. It
does not require a persistent grant to the general Customer directory.

An uncertain creation response previously required national-ID recovery, even
though contract entry now permits missing national IDs. That leaves a nameless
registration outcome impossible to recover safely. A definitive create conflict
was also incorrectly treated as an uncertain commit. Existing-person update
conflicts did not mark the profile for refresh before the next confirmation.

Sales Web now sends an optional UUID `x-registration-key` to Customer's
Sales-only creation endpoint. Customer validates the key and performs creation
plus a registration receipt in one transaction, serializing actor/branch/key
replays with a PostgreSQL transaction advisory lock. The receipt reuses the
existing audit table, contains only a payload fingerprint and person reference,
and rejects changed payloads and unavailable people. Ordinary Customer create
and clients without the header retain their prior behavior. No schema change.

The Web client retries a receipt-backed uncertain request once automatically.
Its people draft retains the exact request and receipt for later no-ID recovery;
legacy national-ID recovery remains supported. A repeated unchanged request
retains its receipt. Forbidden and validation responses are not auto-replayed.
Definitive create conflicts do not produce the uncertain-registration state.
An existing-person update conflict marks the profile for an authorized refresh,
preserving the user's edited fields before a later retry.

Authorization remains contract-create plus new-contract route access, actor
branches, Customer's existing public policy and audit. There is no global IAM
grant, cross-branch lookup, general directory write bypass or operational-data
change. This source-level diagnosis does not establish the exact HTTP error of
the photographed production session; no production identity data was copied.

Verification includes the contract-only controller journey, malformed receipt
rejection, Customer service authorization, repository receipt replay/payload
conflict, no-national-ID lost-response recovery, client retry boundaries, and
existing-profile concurrency recovery. Full build/type checks and hosted review
remain merge gates. No deployment was requested for this work item.
