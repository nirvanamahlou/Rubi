WITH legacy_offers AS (
  SELECT
    offer.*,
    COALESCE(
      (SELECT "id" FROM "iam_users" WHERE "id" = offer."createdByUserId"),
      (
        SELECT membership."userId"
        FROM "iam_user_branches" membership
        JOIN "iam_users" member ON member."id" = membership."userId"
        WHERE membership."branchId" = offer."branchId"
          AND member."status" = 'ACTIVE'
        ORDER BY membership."isPrimary" DESC, membership."grantedAt" ASC
        LIMIT 1
      )
    ) AS "requesterId"
  FROM "TicketPublishedOffer" offer
)
INSERT INTO "finance_ticket_pricing_requests" (
  "id",
  "ticketOfferId",
  "branchId",
  "status",
  "version",
  "requestedByUserId",
  "requestedAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  offer."id",
  offer."branchId",
  'PENDING',
  0,
  offer."requesterId",
  offer."createdAt",
  CURRENT_TIMESTAMP
FROM legacy_offers offer
WHERE offer."requesterId" IS NOT NULL
ON CONFLICT ("ticketOfferId") DO NOTHING;
