# Unnamed guests in historical contract purchases

PC-A implements the owner's request on branch
`codex/pc-a-legacy-unnamed-purchase-1029`.

Historical contracts can carry explicit adult/child/infant counts per service in
Sales' existing `legacyServicePartiesV2` metadata, with no registered passenger
identities. The purchase editor previously rendered zero hotel price rows because
it used only registered passenger IDs. The new shared helper derives numbered
guest slots from the saved count of the particular service, only when the entire
snapshot has no real passenger roster. It never guesses counts for other history.

The editor shows passenger 1, passenger 2, etc. with adult/child/infant categories.
Hotel nightly prices use the new optional `legacyGuestPrices` input containing a
zero-based `guestIndex`, not a customer ID. The server independently resolves the
allowed slots, rejects mixed real/legacy inputs, foreign/duplicate ordinals and
invalid amounts, and recomputes totals from contractual nights. Blank prices keep
the existing partial-purchase behavior. Transfer count defaults use its own saved
service counts, without counting round-trip passengers twice.

Legacy hotel prices are stored as `{ legacyGuests: [...] }` in existing immutable
purchase JSON revisions; the public projection exposes optional
`legacyGuestPrices` for reopening the editor. Saved prices only restore to a slot
with the same ordinal and age category. Real passenger pricing and its UUID
validation remain unchanged. No placeholder Customer, Sales passenger or identity
FK is created, and no historical snapshot is rewritten.

Reservations owns both validation and purchase revisions. Finance continues to
consume the existing purchase amount, currency, supplier, revision and payment
workflow. Authorization, branch scope, idempotency and optimistic version checks
are retained. API and Web should be released together for the additive fields.
No schema, migration, dependencies, operational data or runtime change.

Focused verification covers counts/categories, named-roster precedence,
hotel/transfer rendering, exact totals, slot tampering and actual purchase service
persistence. Full final-head quality/build and CI remain gates for the requested
develop merge; GitHub CLI authentication was expired during implementation.
