import { Inject, Injectable, ConflictException } from '@nestjs/common';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';

/** Tasks-owned persistence port. The domain supplies encrypted private payloads only. */
@Injectable()
export class CallCenterTasksService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  async matchingRequests(
    branchId: string,
    view: string,
    actorId: string,
    start: Date,
    end: Date,
  ) {
    const rows = await this.database.client.automationTask.findMany({
      where: {
        sourceModule: 'CALL_CENTER',
        branchId,
        status: 'OPEN',
        ...(view === 'MINE' ? { assigneeUserId: actorId } : {}),
        ...(view === 'TODAY' ? { dueAt: { gte: start, lt: end } } : {}),
        ...(view === 'OVERDUE' ? { dueAt: { lt: new Date() } } : {}),
      },
      select: { sourceReference: true },
      distinct: ['sourceReference'],
    });
    return rows.map((row) => row.sourceReference);
  }
  list(tx: Prisma.TransactionClient, branchId: string, ticketIds: string[]) {
    return tx.automationTask.findMany({
      where: {
        sourceModule: 'CALL_CENTER',
        branchId,
        sourceReference: { in: ticketIds },
      },
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
    });
  }
  async save(
    tx: Prisma.TransactionClient,
    input: {
      id: string;
      ticketId: string;
      branchId: string;
      ownerId: string;
      dueAt: Date;
      status: string;
      payload: Prisma.InputJsonValue;
      expectedVersion: number;
    },
  ) {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${'cc-task:' + input.id},0))`;
    const prior = await tx.automationTask.findUnique({
      where: { id: input.id },
    });
    if (
      prior &&
      (prior.sourceModule !== 'CALL_CENTER' ||
        prior.branchId !== input.branchId ||
        prior.sourceReference !== input.ticketId)
    )
      throw new ConflictException('شناسه پیگیری متعلق به پرونده دیگری است.');
    const priorVersion = prior
      ? Number((prior.payload as { version?: number }).version)
      : 0;
    if (priorVersion !== input.expectedVersion)
      throw new ConflictException(
        'پیگیری تغییر کرده است؛ اطلاعات را دوباره دریافت کنید.',
      );
    return tx.automationTask.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        callCenterTicketId: input.ticketId,
        sourceModule: 'CALL_CENTER',
        sourceEventId: input.id,
        sourceReference: input.ticketId,
        branchId: input.branchId,
        assigneeUserId: input.ownerId,
        kind: 'CALL_CENTER_FOLLOW_UP',
        title: 'پیگیری کال سنتر',
        dueAt: input.dueAt,
        status: input.status,
        payload: input.payload,
        completedAt: input.status === 'OPEN' ? null : new Date(),
      },
      update: {
        assigneeUserId: input.ownerId,
        dueAt: input.dueAt,
        status: input.status,
        payload: input.payload,
        completedAt: input.status === 'OPEN' ? null : new Date(),
      },
    });
  }
  markReminded(
    tx: Prisma.TransactionClient,
    id: string,
    payload: Prisma.JsonValue,
  ) {
    return tx.automationTask.update({
      where: { id },
      data: {
        payload: { ...(payload as Prisma.InputJsonObject), reminded: true },
      },
    });
  }
  async dueIds(now: Date, after?: string) {
    return this.database.client.automationTask.findMany({
      where: {
        sourceModule: 'CALL_CENTER',
        ...(after ? { id: { gt: after } } : {}),
        status: 'OPEN',
        dueAt: { lte: now },
      },
      select: { id: true, sourceReference: true, branchId: true },
      orderBy: { id: 'asc' },
      take: 100,
    });
  }
}
