import { ConflictException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  CONTRACT_TOTAL_PURCHASE_KEY,
  type AuthenticatedActor,
  type ReservationServicePurchaseInputV1,
} from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { PurchaseFxService } from '../finance/purchase-fx/purchase-fx.service';
import { assertFloatingPurchaseMode } from './floating-purchase-mode';
import type { floatingPassengerPurchaseGroups } from './floating-passenger-purchase';

export async function recordFloatingPassengerPurchase(
  database: DatabaseService,
  fx: PurchaseFxService | undefined,
  intake: { id: string; contractId: string; branchId: string },
  actor: AuthenticatedActor,
  input: ReservationServicePurchaseInputV1,
  key: string,
  broker: { id: string; source?: string; name: string },
  groups: ReturnType<typeof floatingPassengerPurchaseGroups>,
  serviceKeys: string[],
) {
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ intakeId: intake.id, ...input }))
    .digest('hex');
  const unique = {
    actorUserId_idempotencyKey: {
      actorUserId: actor.userId,
      idempotencyKey: key,
    },
  };
  const replay = (row: {
    id: string;
    version: number;
    fingerprint: string;
  }) => {
    if (row.fingerprint !== fingerprint)
      throw new ConflictException(
        'کلید ثبت برای اطلاعات دیگری استفاده شده است.',
      );
    return { version: 1 as const, data: { id: row.id, version: row.version } };
  };
  const previous = await database.client.reservationServicePurchase.findUnique({
    where: unique,
  });
  if (previous) return replay(previous);
  try {
    return await database.client.$transaction(async (tx) => {
      await assertFloatingPurchaseMode(
        tx,
        intake.contractId,
        intake.branchId,
        true,
      );
      const changed = await tx.reservationIntake.updateMany({
        where: {
          id: intake.id,
          branchId: { in: actor.branchIds },
          purchaseVersion: input.expectedVersion,
        },
        data: { purchaseVersion: { increment: groups.length } },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          'خرید هم‌زمان تغییر کرده است؛ دوباره بارگذاری کنید.',
        );
      let first: { id: string; version: number } | undefined;
      const batchId = randomUUID();
      for (const [index, group] of groups.entries()) {
        const row = await tx.reservationServicePurchase.create({
          data: {
            intakeId: intake.id,
            batchId,
            serviceClientKey: CONTRACT_TOTAL_PURCHASE_KEY,
            coveredServiceClientKeys: [
              CONTRACT_TOTAL_PURCHASE_KEY,
              ...serviceKeys,
            ],
            serviceKind: 'OTHER',
            serviceTitleSnapshot: 'خرید کل قرارداد به تفکیک مسافر',
            supplierOrganizationId:
              broker.source === 'BROKER' ? null : broker.id,
            supplierBrokerId: broker.source === 'BROKER' ? broker.id : null,
            supplierNameSnapshot: broker.name,
            version: input.expectedVersion + index + 1,
            amount: group.amount,
            currencyCode: group.currencyCode,
            passengerPrices: group.passengerPrices,
            actorUserId: actor.userId,
            idempotencyKey: index ? key + ':' + index : key,
            fingerprint,
          },
        });
        first ??= row;
        await fx?.capture(tx, {
          reservationPurchaseId: row.id,
          branchId: intake.branchId,
          actorUserId: actor.userId,
          currencyCode: group.currencyCode,
          amount: group.amount,
          baselineAt: row.createdAt,
        });
      }
      return { version: 1 as const, data: first! };
    });
  } catch (error) {
    const saved = await database.client.reservationServicePurchase.findUnique({
      where: unique,
    });
    if (saved) return replay(saved);
    throw error;
  }
}
