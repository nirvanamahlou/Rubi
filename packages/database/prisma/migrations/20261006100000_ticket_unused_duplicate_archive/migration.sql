-- Visibility repair only: preserve IDs, prices, purchases and audit.
-- Any contractual/capacity history is protected. Prefer a priced/financial
-- source as canonical; archive other unused inventory without changing any
-- price or financial reference. Different cabins/dates/supplies stay separate.
BEGIN;
LOCK TABLE "TicketPublishedOffer" IN ACCESS EXCLUSIVE MODE;
WITH classified AS (
  SELECT o.*,
    (
      EXISTS (SELECT 1 FROM sales_contract_ticket_selections s WHERE s.offer_id = o.id::text) OR
      EXISTS (SELECT 1 FROM "TicketOfferCapacityAllocation" a WHERE a."offerId" = o.id) OR
      EXISTS (SELECT 1 FROM "TicketOfferCapacityHold" h WHERE h."offerId" = o.id) OR
      EXISTS (SELECT 1 FROM "TourDeparture" t WHERE t."outboundOfferId" = o.id OR t."returnOfferId" = o.id)
    ) AS protected,
    (
      EXISTS (SELECT 1 FROM "TicketOfferStandaloneSalePrice" p WHERE p."offerId" = o.id) OR
      EXISTS (SELECT 1 FROM "TicketOfferRoundTripSalePrice" p WHERE p."outboundOfferId" = o.id OR p."returnOfferId" = o.id) OR
      EXISTS (SELECT 1 FROM "TicketSaleCommissionRevision" c WHERE c."offerId" = o.id OR c."returnOfferId" = o.id) OR
      EXISTS (SELECT 1 FROM "FinanceTicketPurchaseCostRevision" c WHERE c."offerId" = o.id) OR
      EXISTS (SELECT 1 FROM "ProcurementTicketPurchaseRequest" p WHERE p."branchId" = o."branchId" AND (p."offerId" = o.id OR p."catalogProductReference" = o.id::text OR p."catalogProductReference" = regexp_replace(o."createKey", '^ticket-catalog:', '')) AND (p.amount IS NOT NULL OR p.status <> 'PENDING' OR EXISTS (SELECT 1 FROM "FinanceTicketPurchaseCostRevision" c WHERE c."requestId" = p.id)))
    ) AS priced
  FROM "TicketPublishedOffer" o
  WHERE NOT EXISTS (SELECT 1 FROM "TicketOfferAudit" a WHERE a."offerId" = o.id AND a.action = 'ticket.offer.archived')
), ranked AS (
  SELECT id, protected,
    row_number() OVER (
      PARTITION BY "branchId", "originId", "destinationId", "departureAt", "arrivalAt",
        lower(trim("carrierName")), lower(trim("serviceNumber")), "cabinClassCode",
        coalesce("supplyType", 'COMPANY'), "totalCapacity", "originAirportId", "destinationAirportId",
        "economyBaggageKg", "businessBaggageKg", "returnMinDays", "returnMaxDays", "manifestTemplateId"
      ORDER BY protected DESC, priced DESC, (status = 'ACTIVE') DESC, "createdAt", id
    ) AS duplicate_rank
  FROM classified
), archived AS (
  UPDATE "TicketPublishedOffer" o
  SET status = 'PAUSED', version = o.version + 1
  FROM ranked r WHERE o.id = r.id AND r.duplicate_rank > 1 AND NOT r.protected
  RETURNING o.id, o.version, o."createdByUserId"
)
INSERT INTO "TicketOfferAudit" (id, "offerId", "actorUserId", action, version, "occurredAt")
SELECT gen_random_uuid(), id, "createdByUserId", action, version, now()
FROM archived CROSS JOIN (VALUES ('ticket.offer.duplicate_archived'), ('ticket.offer.archived')) AS actions(action);
COMMIT;
