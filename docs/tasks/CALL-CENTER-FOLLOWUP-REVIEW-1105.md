# Call Center follow-up review — PC-C

The owner confirmed on 2026-11-05: a saved result of a related call, including NO_ANSWER, by the responsible expert sends the request to its creator's My Work review queue. The manager's decision acknowledges the observed follow-up; later distinct follow-ups can queue another review. Execution owner and request status remain unchanged until an authorized management edit.

Use durable, uniquely keyed request/call receipts, real foreign keys and UTC timestamps. Editing or replaying the same call must not requeue a completed review. Keep branch/contact/request authorization and manager-only decision checks. A stale decision cannot consume a newer follow-up. Never infer a follow-up from unrelated latest contact history, a telephony event alone, or merely linking an old call.

The editor shows separate contact name and phone rows. Show subject only from the saved related follow-up receipt; remove the technical visible description. Existing approved layout/palette remains otherwise intact. No production deployment is included.

## Contract and rollout

Producer: Customer Affairs workflow and authorized completion/SAVE entrypoints. Consumers: Call Center queue and request editor. Request data gains optional `contactSummary` and `review` fields; queue rows gain `pendingReview`. A creator-manager submits `expectedReviewToken` alongside the existing request version and command ID. Old clients without a token cannot acknowledge a follow-up. An exact-request read returns only the minimal contact header, linked follow-up subject and authorized request data, not the contact's unrelated call history.

Apply migrations `20261105110000_call_center_request_review` and `20261105111000_call_center_wrong_number_outcome` before an eventual API rollout. The first creates durable receipts without historical inference; the second repairs the pre-existing outcome constraint to match the established public contract. Neither rewrites existing calls. Web and API are compatible with the optional fields; no dependency changes or new grants are required. Production publication remains excluded from this work item.

## Validation

Both affected production builds, Prisma validation, scoped ESLint and TypeScript passed. Tests include 19 helper cases, 7 UI cases, 3 translation checks and 5 CI policy checks. Twenty new PostgreSQL integration cases pass against an isolated database after all 222 migrations: both actual SAVE paths, all five results, creator access, owner/status preservation, duplicate concurrent saves, new-call requeue, stale decisions, invalid outcomes, branch isolation and a receipt committed between the displayed read and token assembly. All 87 existing affected Call Center regression cases also pass. The new integration suite is included in the existing PostgreSQL CI gate; no gate is weakened. Final integrated GitHub checks are required before develop merge.
