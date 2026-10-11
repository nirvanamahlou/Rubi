import { Prisma } from '@nora/database';
import type {
  parsePurchaseQuery,
  PurchaseFlightFacts,
} from './reservation-purchase-query';

export function purchaseSelectionSql(
  branchIds: readonly string[],
  q: ReturnType<typeof parsePurchaseQuery>,
  flights: PurchaseFlightFacts | undefined,
  summary = false,
) {
  const sort = q.direction === 'ASC' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const selection = summary
    ? Prisma.sql`SELECT count(*)::int AS total,
        count(*) FILTER (WHERE status = 'REGISTERED')::int AS registered,
        count(*) FILTER (WHERE status = 'UNREGISTERED')::int AS unregistered,
        count(*) FILTER (WHERE status = 'UNKNOWN')::int AS unknown,
        count(DISTINCT "id")::int AS contracts FROM filtered`
    : Prisma.sql`SELECT * FROM filtered WHERE (${q.status} = 'ALL' OR status = ${q.status})
        ORDER BY "sortAt" ${sort} NULLS LAST, "id" ASC, "clientKey" ASC LIMIT 26 OFFSET ${(q.page - 1) * 25}`;
  return Prisma.sql`
    WITH scoped AS (
      SELECT i.*, CASE WHEN jsonb_typeof(i."snapshot"->'serviceSelections') = 'array' THEN i."snapshot"->'serviceSelections' ELSE '[]'::jsonb END AS selections,
        CASE WHEN jsonb_typeof(i."snapshot"->'ticketSelections') = 'array' THEN i."snapshot"->'ticketSelections' ELSE '[]'::jsonb END AS tickets
      FROM "ReservationIntake" i WHERE i."branchId" IN (${Prisma.join(branchIds.map((id) => Prisma.sql`${id}::uuid`))})
        AND (${q.contractNumber} = '' OR strpos(i."snapshot"->>'contractNumber', ${q.contractNumber}) > 0)
    ), services AS (
      SELECT i.*, s.service FROM scoped i CROSS JOIN LATERAL (
        SELECT service FROM jsonb_array_elements(i.selections) service WHERE service->>'kind' IN ('HOTEL','FLIGHT','TRANSFER','INSURANCE')
        UNION ALL SELECT jsonb_build_object('kind','HOTEL','clientKey',i."snapshot"->'hotelSelection'->>'serviceClientKey')
          WHERE jsonb_typeof(i."snapshot"->'hotelSelection') = 'object' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(i.selections) x WHERE x->>'clientKey' = i."snapshot"->'hotelSelection'->>'serviceClientKey')
        UNION ALL SELECT jsonb_build_object('kind','FLIGHT','clientKey',t->>'serviceClientKey','referenceId',t->>'offerId') FROM jsonb_array_elements(i.tickets) t
          WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(i.selections) x WHERE x->>'clientKey' = t->>'serviceClientKey')
        UNION ALL SELECT jsonb_build_object('kind','FLIGHT','clientKey',o,'referenceId',o) FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(i."snapshot"->'selectedTicketOfferIds') = 'array' THEN i."snapshot"->'selectedTicketOfferIds' ELSE '[]'::jsonb END) o
          WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(i.selections) x WHERE x->>'kind' IN ('FLIGHT','TRAIN','BUS'))
            AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(i.tickets) t WHERE t->>'offerId' = o)
      ) s WHERE (${q.kind} = 'ALL' OR s.service->>'kind' = ${q.kind})
    ), facts AS (
      SELECT s."id", s.service->>'kind' AS kind, p.version AS "purchaseVersion", p."coveredServiceClientKeys", s.service->>'clientKey' AS "clientKey",
        CASE WHEN p."createdAt" IS NOT NULL OR h.at IS NOT NULL OR f.registered THEN 'REGISTERED'
          WHEN s.service->>'kind' = 'FLIGHT' AND NOT ${flights !== undefined} THEN 'UNKNOWN' ELSE 'UNREGISTERED' END AS status,
        to_char(s."receivedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "entryAt",
        CASE WHEN s.service->>'kind' = 'FLIGHT' THEN COALESCE(t.ticket->>'departureAt', s.service->'metadata'->>'flightDepartureAt', s.service->'metadata'->>'departureAt', f."departureAt") END AS "departureAt",
        CASE WHEN s.service->>'kind' = 'HOTEL' THEN COALESCE(s.service->'metadata'->>'checkInDate', CASE WHEN s."snapshot"->'hotelSelection'->>'serviceClientKey' = s.service->>'clientKey' THEN s."snapshot"->'hotelSelection'->>'checkInDate' END) END AS "checkInAt",
        COALESCE(to_char(p."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(h.at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), f."purchasedAt") AS "purchasedAt"
      FROM services s
      LEFT JOIN LATERAL (SELECT p."createdAt", p.version, p."coveredServiceClientKeys" FROM "ReservationServicePurchase" p WHERE p."intakeId" = s."id" AND (p."serviceClientKey" = s.service->>'clientKey' OR p."coveredServiceClientKeys" ? (s.service->>'clientKey')) ORDER BY p.version DESC LIMIT 1) p ON true
      LEFT JOIN LATERAL (SELECT max(h."createdAt") AS at FROM "ReservationHotelPurchase" h WHERE h."intakeId" = s."id" AND s.service->>'kind' = 'HOTEL') h ON true
      LEFT JOIN LATERAL (SELECT ticket FROM jsonb_array_elements(s.tickets) ticket WHERE ticket->>'serviceClientKey' = s.service->>'clientKey' LIMIT 1) t ON true
      LEFT JOIN LATERAL (SELECT f.* FROM jsonb_to_recordset(${JSON.stringify(flights ?? [])}::jsonb) AS f(id text,"branchId" text,"offerId" text,"referenceId" text,registered boolean,"entryAt" text,"departureAt" text,"purchasedAt" text)
        WHERE f."branchId" = s."branchId"::text AND s.service->>'kind' = 'FLIGHT' AND (f."offerId" = COALESCE(t.ticket->>'offerId',s.service->>'referenceId') OR f."referenceId" = COALESCE(t.ticket->>'offerId',s.service->>'referenceId')) ORDER BY f."entryAt" DESC, f.id ASC LIMIT 1) f ON true
    ), grouped AS (
      SELECT "id", min("clientKey") AS "clientKey", status,
        array_agg("clientKey" ORDER BY "clientKey") AS "coveredServiceClientKeys",
        max("entryAt") AS "entryAt", max("departureAt") AS "departureAt",
        max("checkInAt") AS "checkInAt", max("purchasedAt") AS "purchasedAt"
      FROM facts GROUP BY "id", status,
        CASE WHEN kind = 'TRANSFER' AND "purchaseVersion" IS NULL THEN 'transfer-unregistered'
          WHEN kind = 'TRANSFER' AND jsonb_array_length(CASE WHEN jsonb_typeof("coveredServiceClientKeys") = 'array' THEN "coveredServiceClientKeys" ELSE '[]'::jsonb END) > 1 THEN 'transfer-purchase-' || "purchaseVersion"::text
          ELSE 'service-' || "clientKey" END
    ), dated AS (
      SELECT *, CASE ${q.dateBy} WHEN 'ENTRY' THEN "entryAt" WHEN 'DEPARTURE' THEN "departureAt" WHEN 'CHECK_IN' THEN "checkInAt" WHEN 'PURCHASE' THEN "purchasedAt" END AS "sortAt" FROM grouped
    ), filtered AS (
      SELECT * FROM dated WHERE (${q.from} = '' OR left("sortAt",10) >= ${q.from}) AND (${q.to} = '' OR left("sortAt",10) <= ${q.to})
    ) ${selection}
  `;
}
