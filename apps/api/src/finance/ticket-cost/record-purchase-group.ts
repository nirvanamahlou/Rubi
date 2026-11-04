import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  TicketPurchaseGroupCommandV1,
} from '@nora/contracts';
import { moneyDecimal, moneyUnits } from '@nora/contracts';
import { Prisma } from '@nora/database';
import type { DatabaseService } from '../../database/database.service';
import type { ProcurementPublicService } from '../../procurement/procurement-public.service';
import type { TicketPublicService } from '../../ticket-catalog/ticket-public.service';
import type { PurchaseFxService } from '../purchase-fx/purchase-fx.service';
import { purchaseFlightGroup, readPurchasePool } from './ticket-purchase-group';
const uuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export async function recordPurchaseGroup(
  database: DatabaseService,
  procurement: ProcurementPublicService,
  tickets: TicketPublicService | undefined,
  fx: PurchaseFxService | undefined,
  input: TicketPurchaseGroupCommandV1,
  actor: AuthenticatedActor,
) {
  if (!actor.permissions.includes('procurement.quote.manage'))
    throw new ForbiddenException();
  if (
    input?.version !== 1 ||
    !uuid(input.operationId) ||
    !/^[A-Z]{3}$/.test(input.currencyCode ?? '') ||
    !Array.isArray(input.members) ||
    input.members.length < 2 ||
    input.members.length > 366 ||
    input.members.some(
      (m) =>
        !m ||
        !uuid(m.requestId) ||
        !Number.isSafeInteger(m.expectedCostVersion) ||
        m.expectedCostVersion < 0,
    ) ||
    new Set(input.members.map((m) => m.requestId.toLowerCase())).size !==
      input.members.length ||
    !Number.isSafeInteger(input.seatCount) ||
    input.seatCount < 1 ||
    input.seatCount > 1000000 ||
    typeof input.totalCost !== 'string' ||
    !/^(?:0|[1-9]\d{0,19})(?:\.\d{1,4})?$/.test(input.totalCost) ||
    (input.purchaseRateToIrr !== undefined &&
      typeof input.purchaseRateToIrr !== 'string')
  )
    throw new BadRequestException('Invalid grouped purchase.');
  const total = new Prisma.Decimal(input.totalCost);
  const unit = total.div(input.seatCount).toDecimalPlaces(4);
  if (total.lte(0) || unit.lte(0))
    throw new BadRequestException('Invalid grouped purchase amount.');
  const members = input.members
    .map((m) => ({ ...m, requestId: m.requestId.toLowerCase() }))
    .sort((a, b) => a.requestId.localeCompare(b.requestId));
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        members,
        seatCount: input.seatCount,
        totalCost: total.toString(),
        currencyCode: input.currencyCode,
        purchaseRateToIrr: input.purchaseRateToIrr ?? null,
      }),
    )
    .digest('hex');
  const prefix = 'purchase-group:' + input.operationId.toLowerCase() + ':';
  const reason =
    prefix + fingerprint + ':' + input.seatCount + ':' + total.toString();
  const replay = async (
    client: Pick<Prisma.TransactionClient, 'financeTicketPurchaseCostRevision'>,
  ) => {
    const rows = await client.financeTicketPurchaseCostRevision.findMany({
      where: { reason: { startsWith: prefix } },
      orderBy: { requestId: 'asc' },
    });
    if (!rows.length) return null;
    if (
      rows.length !== members.length ||
      rows.some(
        (r, i) =>
          r.reason !== reason ||
          r.requestId !== members[i]!.requestId ||
          !actor.branchIds.includes(r.branchId),
      )
    )
      throw new ConflictException('Grouped purchase operation changed.');
    return {
      operationId: input.operationId,
      requestIds: rows.map((r) => r.requestId),
      seatCount: input.seatCount,
      totalCost: total.toString(),
      currencyCode: input.currencyCode,
    };
  };
  const known = await replay(database.client);
  if (known) return known;
  if (!tickets) throw new BadRequestException('Flight inventory unavailable.');
  // Producer reads occur before Finance's transaction; no cross-module table access.
  const requests = await Promise.all(
    members.map((m) => procurement.forFinance(m.requestId, actor.branchIds)),
  );
  const inventory = await tickets.purchaseCapacityInventory(actor.branchIds);
  const identities = requests.map((r) =>
    purchaseFlightGroup(
      r,
      inventory.find((o) => o.id === r.offerId),
    ),
  );
  if (
    identities.some((g) => !g || g.key !== identities[0]?.key) ||
    requests.some(
      (r) => !r.seatCount || r.seatCount < 1 || r.seatCount > 100000,
    ) ||
    requests.reduce((s, r) => s + r.seatCount!, 0) !== input.seatCount ||
    new Set(requests.map((r) => r.offerId)).size !== requests.length
  )
    throw new BadRequestException(
      'Flights do not belong to one capacity purchase group.',
    );
  const totalUnits = moneyUnits(total.toString());
  let cumulative = 0n,
    assigned = 0n;
  const allocations = requests.map((r) => {
    cumulative += BigInt(r.seatCount!);
    const next =
      (totalUnits * cumulative + BigInt(input.seatCount) / 2n) /
      BigInt(input.seatCount);
    const amount = moneyDecimal(next - assigned);
    assigned = next;
    if (new Prisma.Decimal(amount).lte(0))
      throw new BadRequestException(
        'Grouped amount is too small for the selected departures.',
      );
    return amount;
  });
  return database.client.$transaction(
    async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${'ticket-purchase-group:' + input.operationId.toLowerCase()},0))`,
      );
      const retried = await replay(tx);
      if (retried) return retried;
      for (const m of members)
        await tx.$queryRaw(
          Prisma.sql`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${m.requestId},0))`,
        );
      // Revalidate both public producers under row locks in this same transaction.
      const lockedInventory = await tickets.purchaseCapacityInventory(
        actor.branchIds,
        tx,
        requests.map((r) => r.offerId!),
      );
      for (let i = 0; i < requests.length; i++) {
        const current = await procurement.forFinance(
          members[i]!.requestId,
          actor.branchIds,
          tx,
        );
        const old = requests[i]!;
        if (
          JSON.stringify([
            current.requestVersion,
            current.seatCount,
            current.offerId,
            current.offerVersion,
            current.supplierDisplaySnapshot,
          ]) !==
          JSON.stringify([
            old.requestVersion,
            old.seatCount,
            old.offerId,
            old.offerVersion,
            old.supplierDisplaySnapshot,
          ])
        )
          throw new ConflictException(
            'Flight purchase changed. Refresh the inbox.',
          );
      }
      if (
        requests.some(
          (r, i) =>
            purchaseFlightGroup(
              r,
              lockedInventory.find((o) => o.id === r.offerId),
            )?.key !== identities[i]?.key,
        )
      )
        throw new ConflictException(
          'Flight schedule changed. Refresh the inbox.',
        );
      const previous = await Promise.all(
        members.map((m) =>
          tx.financeTicketPurchaseCostRevision.findFirst({
            where: { requestId: m.requestId },
            orderBy: { version: 'desc' },
            include: { payments: { take: 1 } },
          }),
        ),
      );
      for (let i = 0; i < members.length; i++) {
        const old = previous[i];
        if (
          (old?.version ?? 0) !== members[i]!.expectedCostVersion ||
          old?.payments.length
        )
          throw new ConflictException(
            'Purchase changed or payment has started. Refresh the inbox.',
          );
        const pool = readPurchasePool(old?.reason);
        if (pool) {
          const oldMembers =
            await tx.financeTicketPurchaseCostRevision.findMany({
              where: {
                reason: { startsWith: 'purchase-group:' + pool.id + ':' },
              },
              select: { requestId: true },
            });
          if (
            oldMembers.some(
              (r) => !members.some((m) => m.requestId === r.requestId),
            )
          )
            throw new ConflictException(
              'Edit the complete original purchase group.',
            );
        }
      }
      let capturedRate = input.purchaseRateToIrr;
      for (let i = 0; i < requests.length; i++) {
        const r = requests[i]!;
        const row = await tx.financeTicketPurchaseCostRevision.create({
          data: {
            id: randomUUID(),
            requestId: members[i]!.requestId,
            branchId: r.branchId,
            offerId: r.offerId,
            offerVersion: r.offerVersion,
            version: (previous[i]?.version ?? 0) + 1,
            adultUnitCost: unit,
            childUnitCost: new Prisma.Decimal(0),
            invoiceAmount: new Prisma.Decimal(allocations[i]!),
            seatCount: r.seatCount,
            unitCost: unit,
            currencyCode: input.currencyCode,
            reason,
            actorUserId: actor.userId,
          },
        });
        const fxSnapshot = await fx?.capture(tx, {
          ticketCostId: row.id,
          branchId: row.branchId,
          actorUserId: actor.userId,
          currencyCode: input.currencyCode,
          amount: row.invoiceAmount.toString(),
          baselineAt: row.createdAt,
          ...(capturedRate ? { rateToIrr: capturedRate } : {}),
        });
        capturedRate ??= fxSnapshot?.rateToIrr.toString();
      }
      return {
        operationId: input.operationId,
        requestIds: members.map((m) => m.requestId),
        seatCount: input.seatCount,
        totalCost: total.toString(),
        currencyCode: input.currencyCode,
      };
    },
    { timeout: 30000 },
  );
}
