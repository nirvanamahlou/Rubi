import { randomUUID } from 'node:crypto';
import { Module, Injectable, Inject, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { DocumentsModule } from '../documents/documents.module';
import { DocumentsService } from '../documents/documents.service';
import {
  registerPettyCash,
  validatePettyReceipt,
} from './procurement.registrations';
@Injectable()
export class ProcurementMissionPort {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
  ) {}
  async summary(branchId: string, actor: AuthenticatedActor) {
    if (
      !actor.permissions.includes('hr.manage') ||
      !actor.branchIds.includes(branchId)
    )
      throw new ForbiddenException();
    const fund = await this.database.client.procurementPettyFund.findUnique({
      where: { branchId },
    });
    return fund
      ? {
          balance: fund.balance.toString(),
          currencyCode: fund.currencyCode,
          canRegister:
            fund.custodianId === actor.userId ||
            actor.permissions.includes('procurement.assign'),
        }
      : null;
  }
  validateReceipt(
    receipt: unknown,
    branchId: string,
    actor: AuthenticatedActor,
  ) {
    return validatePettyReceipt(receipt, branchId, actor, this.documents);
  }
  async reverse(
    tx: Prisma.TransactionClient,
    entryId: string,
    branchId: string,
    actor: AuthenticatedActor,
  ) {
    if (
      !actor.permissions.includes('hr.manage') ||
      !actor.branchIds.includes(branchId)
    )
      throw new ForbiddenException();
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`petty-registration:${entryId}`}, 0))::text`;
    const entry = await tx.procurementPettyEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: { fund: true },
    });
    if (
      entry.fund.branchId !== branchId ||
      (entry.fund.custodianId !== actor.userId &&
        !actor.permissions.includes('procurement.assign'))
    )
      throw new ForbiddenException();
    if (entry.amount.gte(0)) throw new ForbiddenException();
    const prior = await tx.procurementPettyEntry.findUnique({
      where: { requestKey: entryId },
    });
    if (prior) return;
    await tx.procurementPettyEntry.create({
      data: {
        id: randomUUID(),
        requestKey: entryId,
        fundId: entry.fundId,
        actorId: actor.userId,
        amount: entry.amount.negated(),
      },
    });
    await tx.procurementPettyFund.update({
      where: { id: entry.fundId },
      data: {
        balance: { increment: entry.amount.negated() },
        version: { increment: 1 },
      },
    });
  }
  async register(
    tx: Prisma.TransactionClient,
    body: unknown,
    actor: AuthenticatedActor,
    currency?: string,
  ) {
    if (!actor.permissions.includes('hr.manage'))
      throw new ForbiddenException();
    if (currency) {
      const branchId = (body as { branchId: string }).branchId;
      const fund = await tx.procurementPettyFund.findUnique({
        where: { branchId },
      });
      if (fund && fund.currencyCode !== currency)
        throw new ForbiddenException('ارز هزینه با تنخواه یکسان نیست.');
    }
    // The owner validates fund custodian/manager, branch, evidence, balance and replay.
    return registerPettyCash(this.database, this.documents, body, actor, tx);
  }
}
@Module({
  imports: [DocumentsModule],
  providers: [ProcurementMissionPort],
  exports: [ProcurementMissionPort],
})
export class ProcurementMissionModule {}
