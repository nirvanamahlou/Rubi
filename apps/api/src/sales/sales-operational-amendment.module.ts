import {
  Module,
  Injectable,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@rubi/database';
import type { AuthenticatedActor, VoucherSettingsV1 } from '@rubi/contracts';

/** Public Sales boundary. The caller supplies its transaction for atomic cross-module work. */
@Injectable()
export class SalesOperationalAmendmentService {
  async versionFor(
    tx: Pick<Prisma.TransactionClient, 'salesContract'>,
    id: string,
    branchIds: readonly string[],
  ) {
    const row = await tx.salesContract.findFirst({
      where: { id, branchId: { in: [...branchIds] } },
      select: { version: true },
    });
    if (!row) throw new ForbiddenException('قرارداد در دسترس نیست.');
    return row.version;
  }
  async apply(
    tx: Prisma.TransactionClient,
    contractId: string,
    intakeContractVersion: number,
    settings: VoucherSettingsV1,
    actor: AuthenticatedActor,
    reason: string,
    expectedContractVersion = intakeContractVersion,
  ) {
    const row = await tx.salesContract.findUnique({
      where: { id: contractId },
      include: { services: true },
    });
    if (
      !row ||
      !actor.branchIds.includes(row.branchId) ||
      !(
        actor.permissions.includes('sales.contracts.update.branch') ||
        (actor.permissions.includes('sales.contracts.update.own') &&
          (row.ownerUserId === actor.userId ||
            row.assignedUserId === actor.userId))
      )
    )
      throw new ForbiddenException(
        'برای اعمال تغییرات در قرارداد، مجوز ویرایش قرارداد لازم است.',
      );
    const service =
      row.services.find((s) => s.kind === 'HOTEL') ?? row.services[0];
    if (
      !service ||
      ['CANCELLED', 'DRAFT', 'PENDING_CONFIRMATION'].includes(row.status)
    )
      throw new ConflictException('قرارداد برای اصلاح عملیاتی در دسترس نیست.');
    const metadata =
      service.metadata &&
      typeof service.metadata === 'object' &&
      !Array.isArray(service.metadata)
        ? (service.metadata as Record<string, Prisma.JsonValue>)
        : {};
    let previous: Prisma.JsonValue | undefined;
    try {
      previous =
        typeof metadata.reservationFormAmendment === 'string'
          ? (JSON.parse(metadata.reservationFormAmendment) as Prisma.JsonValue)
          : undefined;
    } catch {
      throw new ConflictException('سابقه اصلاح قرارداد معتبر نیست.');
    }
    if (row.version !== expectedContractVersion)
      throw new ConflictException(
        'نسخه قرارداد تغییر کرده؛ پنجره را دوباره باز کنید.',
      );
    const amendment = {
      version: 1,
      targetContractVersion: row.version + 1,
      sourceContractVersion: intakeContractVersion,
      settings,
      recordedAt: new Date().toISOString(),
      actorUserId: actor.userId,
    };
    const changed = await tx.salesContract.updateMany({
      where: { id: contractId, version: row.version },
      data: { version: { increment: 1 } },
    });
    if (changed.count !== 1)
      throw new ConflictException('قرارداد هم‌زمان تغییر کرد.');
    await tx.salesContractService.update({
      where: { id: service.id },
      data: {
        metadata: {
          ...metadata,
          reservationFormAmendment: JSON.stringify(amendment),
        } as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.salesContractAuditEvent.create({
      data: {
        contractId,
        actorUserId: actor.userId,
        actorBranchId: row.branchId,
        action: 'OPERATIONAL_FORM_AMENDMENT',
        outcome: 'SUCCESS',
        reason,
        beforeSnapshot: previous ?? Prisma.JsonNull,
        afterSnapshot: amendment as unknown as Prisma.InputJsonValue,
      },
    });
    return row.version + 1;
  }
}
@Module({
  providers: [SalesOperationalAmendmentService],
  exports: [SalesOperationalAmendmentService],
})
export class SalesOperationalAmendmentModule {}
