# Background notification classification — PC-D

## Authorization and scope

The owner requests a complete repair of recurring background notifications while
preserving genuine announcements, then hosted CI, a develop PR and merge only
after every check is green. This explicit task instruction overrides the local
PC-D-Integration destination default. Work is isolated on
`codex/pc-d-background-notifications-1107`; the original checkout is unchanged.

## Failure and repair

The global fetch tracker treated the successful POST used to acquire, renew or
release a telephony tab lease as a new Customer Affairs record. The globally
mounted Call Center listener repeats it every two seconds after each response.
This is technical tab coordination, with no new lead, ticket or business event.

Exclude exactly `POST customer-affairs/call-center/telephony/lease`, including
query strings and trailing slashes, alongside the existing six POST query reads.
Do not change polling, request bodies, credentials, cancellation, response streams,
telephony ownership or the persistent server notification producers.

Resolve actual Call Center changes to the more-specific Call Center label and
`/customer-affairs/call-center`, before the parent Customer Affairs mapping.
Lead/ticket mutations remain in Customer Affairs. Genuine call/note/request saves
and explicit workflow actions still announce; there is no time-based debounce or
deduplication that could hide separate real changes.

Peer PR1461 publishes the same exact lease exclusion in a frozen source branch
alongside unrelated HR work. This branch reuses that exclusion verbatim without
modifying the peer branch or HR code. Retain both compatible fixes and tests when
refreshing develop; the extra PC-D work covers the destination and real callers.

## Verification

Before the repair, real-client integration regressions fail: 30 polling cycles
plus the unmount release produce 31 false announcements in each language, and
real mutations point to the parent Customer Affairs page. Background Request/URL
variants also fail. These tests use synthetic responses, never production writes.

Acceptance covers Persian and English localized fetch; lease acquisition,
renewal, hidden-tab release and unmount keepalive; all six query clients; real
create/edit/request/workflow commands; separate real saves at an identical time;
failed saves and cancellation; unchanged credentials/branch/body/response;
Request and URL input forms, query strings and trailing slashes. Existing center,
privacy, read/clear, feed guard, presentation and server-client tests are included.

Local checks and exact-head hosted CI receipts are recorded in the PR. Merge is
allowed only to develop after successful quality, full tests, production build
and PostgreSQL migration/seed gates, followed by a final diff review.

## Data and rollout

No schema, migration, dependency, grants, production data write or deployment.
Old generic browser-local entries have no request provenance; their text also
matches genuine historical saves. Do not delete or rewrite them based on text or
frequency. Existing read/clear actions remain available. The repaired code stops
new false entries when the Web release is deployed and loaded by the browser;
merging to develop alone does not update an already-running production release.
