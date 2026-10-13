# RESERVATION-OPERATION-SUMMARY-0929

PC-A; branch `codex/pc-a-reservation-operation-summary-0929`; latest develop baseline. User requests financial-delivery approval, automatically recorded time/responsible person and the latest reservation operator in the selected contract bar, with the operation box removed from Events.

## Implementation

The selected header shows last reservation mutation on the right of financial-delivery status. Finance remains the owner of approvals: Reservations composes `FinanceDeliveryService.read`, which already returns database-generated revision time and authenticated actor ID. The new summary exposes only approval, time and the responsible name, never amounts or reasons. The checkbox is read-only; this task adds no approval operation or alternative authorization.

`GET /reservations/requests/:id/operation-summary` requires authenticated `reservations.read`, validates the UUID and checks intake branch before querying Finance/IAM. Public IAM methods resolve only the responsible actors of that authorized resource, without requiring or exposing the privileged user directory. Native reservation revision streams (workflow/notes/settings, room arrangements, hotel and service purchases) provide historical actor/commit time. A successful-mutation interceptor records passenger identity/name and document-upload responsibility in existing IAM AuditEvent storage. Reads, failed operations, Finance approval/payment operations and native revision handlers are excluded; native purchase replay preserves the original timestamp. New mutation records contain only intake ID, branch ID, operation name and authenticated actor; no request body, passenger data or client timestamp.

The audit append for passenger/file operations completes before the successful HTTP response; the underlying domain mutation remains owned by its existing service. This is responsibility metadata, not a replacement for transactional domain audit. Legacy passenger/file activity without existing responsibility records is not fabricated; the latest available native revision is shown, or a missing-history label. No schema/migration/dependency change and no real database/account mutation during development.

The additive `ReservationOperationSummaryV1` Travel contract is produced by Reservations, via the public Finance/IAM boundaries, and consumed only by the selected-header Web component. Existing queue/workflow responses remain compatible. The component refreshes on reservation-change events, focus/visibility and every 15 seconds while visible; selection changes remount it. Dates remain UTC on the wire and display in Asia/Tehran with seconds. Errors are shown explicitly. The selected-contract operation box is omitted on the Events tab; event history/permissions remain.

## Validation and handoff

- Scoped API tests cover summary permissions, branch isolation, actual actor attribution, failed mutations, financial revocation, unknown history, response minimization and native replay exclusion.
- HTTP tests cover authenticated/read-only summary and passenger mutation authorization.
- Historical fallback tests compare commit times across native streams; Web tests cover checked/revoked state, exact wire timestamps, ordered responsibility blocks and Events box removal.
- Strict API/Web types, scoped lint, production builds and CI checked before integration; final counts recorded in Project Status.
- No operational financial approval or passenger change was made. Authenticated visual browser QA is not claimed; browser attachment is unavailable.
- Bounded IAM/Reservations/Travel/docs locks release with scoped commit. Migration/dependency locks not acquired.
