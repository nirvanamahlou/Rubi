import { Prisma } from '@nora/database';
import type {
  AuthenticatedActor,
  ProcurementPettyRegistrationV1,
} from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { DocumentsService } from '../documents/documents.service';
import { decimal, requireRule } from './domain/procurement.rules';
import * as v from './procurement.validation';

type Registration = Prisma.ProcurementPettyEntryGetPayload<{
  include: { fund: true };
}>;
function dto(row: Registration): ProcurementPettyRegistrationV1 {
  return {
    costCenter: row.costCenter ?? '',
    fee: row.fee?.toString() ?? '0',
    description: row.description ?? '',
    id: row.id,
    title: row.title!,
    occurredAt: row.occurredAt!.toISOString(),
    amount: row.amount.negated().toString(),
    currencyCode: row.fund.currencyCode,
    branchId: row.fund.branchId,
    receiptDocumentId: row.receiptDocumentId,
    receiptVersionId: row.receiptVersionId,
  };
}
export async function registerPettyCash(
  database: DatabaseService,
  documents: DocumentsService,
  body: unknown,
  actor: AuthenticatedActor,
  transaction?: Prisma.TransactionClient,
) {
  const input = v.object(body, [
    'id',
    'branchId',
    'title',
    'occurredAt',
    'amount',
    'receipt',
    'costCenter',
    'fee',
    'description',
  ]);
  const id = v.uuid(input.id),
    branchId = v.uuid(input.branchId, 'branchId');
  const title = v.text(input.title, 'title', 240),
    occurredAt = v.date(input.occurredAt, 'occurredAt');
  const amount = v.text(input.amount, 'amount', 26);
  const costCenter = v.text(input.costCenter, 'costCenter', 160, true);
  const description = v.text(input.description, 'description', 2000, true);
  const fee = v.text(input.fee ?? '0', 'fee', 26);
  requireRule(
    decimal(fee) <= decimal(amount),
    'VALIDATION_ERROR',
    'کارمزد نمی‌تواند بیشتر از مبلغ کل باشد.',
    'fee',
  );
  requireRule(
    decimal(amount) > 0n,
    'VALIDATION_ERROR',
    'مبلغ باید بیشتر از صفر باشد.',
    'amount',
  );
  requireRule(
    actor.branchIds.includes(branchId),
    'FORBIDDEN',
    'شعبه مجاز نیست.',
  );
  const { receiptDocumentId, receiptVersionId } = await validatePettyReceipt(
    input.receipt,
    branchId,
    actor,
    documents,
  );
  const write = async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`petty-registration:${id}`}, 0))::text`;
    const fund = await tx.procurementPettyFund.findUnique({
      where: { branchId },
    });
    requireRule(
      Boolean(fund),
      'INVALID_STATE',
      'ابتدا حساب تنخواه این شعبه را تنظیم کنید.',
    );
    requireRule(
      fund!.custodianId === actor.userId ||
        actor.permissions.includes('procurement.assign'),
      'FORBIDDEN',
      'فقط مسئول تنخواه یا مدیر خرید می‌تواند هزینه ثبت کند.',
    );
    const prior = await tx.procurementPettyEntry.findUnique({
      where: { id },
      include: { fund: true },
    });
    if (prior) {
      requireRule(
        prior.actorId === actor.userId &&
          prior.fundId === fund!.id &&
          (prior.costCenter ?? '') === costCenter &&
          (prior.description ?? '') === description &&
          (prior.fee ?? new Prisma.Decimal(0)).equals(fee) &&
          prior.title === title &&
          prior.occurredAt?.toISOString() === occurredAt &&
          prior.amount.negated().equals(amount) &&
          prior.receiptDocumentId === receiptDocumentId &&
          prior.receiptVersionId === receiptVersionId,
        'IDEMPOTENCY_CONFLICT',
        'این کلید قبلاً برای ورودی دیگری استفاده شده است.',
      );
      return dto(prior);
    }
    const value = new Prisma.Decimal(amount);
    const changed = await tx.procurementPettyFund.updateMany({
      where: {
        id: fund!.id,
        version: fund!.version,
        balance: { gte: value },
      },
      data: { balance: { decrement: value }, version: { increment: 1 } },
    });
    requireRule(
      changed.count === 1,
      'CONCURRENT_MODIFICATION',
      'موجودی کافی نیست یا تنخواه هم‌زمان تغییر کرده است؛ دوباره بررسی کنید.',
    );
    return dto(
      await tx.procurementPettyEntry.create({
        data: {
          id,
          fundId: fund!.id,
          actorId: actor.userId,
          amount: value.negated(),
          title,
          costCenter: costCenter || null,
          description: description || null,
          fee: new Prisma.Decimal(fee),
          occurredAt: new Date(occurredAt),
          receiptDocumentId,
          receiptVersionId,
        },
        include: { fund: true },
      }),
    );
  };
  return transaction
    ? write(transaction)
    : database.client.$transaction(write, { timeout: 30000 });
}
export async function listPettyRegistrations(
  database: DatabaseService,
  query: Record<string, unknown>,
  actor: AuthenticatedActor,
) {
  v.object(query, ['branchId', 'search', 'from', 'to', 'page']);
  const branchId = query.branchId
    ? v.uuid(query.branchId, 'branchId')
    : undefined;
  requireRule(
    !branchId || actor.branchIds.includes(branchId),
    'FORBIDDEN',
    'شعبه مجاز نیست.',
  );
  const search = v.text(query.search, 'search', 120, true);
  const page = v.integer(Number(query.page ?? 1), 'page', 100000);
  const from = query.from
    ? v.date(`${v.text(query.from, 'from', 10)}T00:00:00.000Z`, 'from')
    : undefined;
  const to = query.to
    ? v.date(`${v.text(query.to, 'to', 10)}T23:59:59.999Z`, 'to')
    : undefined;
  requireRule(
    !from || !to || from <= to,
    'VALIDATION_ERROR',
    'بازه تاریخ معتبر نیست.',
  );
  const where: Prisma.ProcurementPettyEntryWhereInput = {
    title: {
      not: null,
      ...(search ? { contains: search, mode: 'insensitive' } : {}),
    },
    fund: { branchId: branchId ?? { in: actor.branchIds } },
    ...(!actor.permissions.includes('procurement.read.all') &&
    !actor.permissions.includes('procurement.assign')
      ? { actorId: actor.userId }
      : {}),
    ...(from || to
      ? {
          occurredAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };
  const rows = await database.client.$transaction(
    async (tx) => {
      // A mission reversal uses the original entry ID as its request key.
      const reversals = await tx.procurementPettyEntry.findMany({
        where: {
          fund: { branchId: branchId ?? { in: actor.branchIds } },
          title: null,
          amount: { gt: 0 },
          requestKey: { not: null },
        },
        select: { requestKey: true },
      });
      return tx.procurementPettyEntry.findMany({
        where: {
          ...where,
          id: {
            notIn: reversals.flatMap(({ requestKey }) =>
              requestKey ? [requestKey] : [],
            ),
          },
        },
        include: { fund: true },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * 25,
        take: 26,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  return {
    items: rows.slice(0, 25).map(dto),
    page,
    pageSize: 25,
    hasMore: rows.length > 25,
  };
}

export async function validatePettyReceipt(
  input: unknown,
  branchId: string,
  actor: AuthenticatedActor,
  documents: DocumentsService,
) {
  let receiptDocumentId: string | null = null,
    receiptVersionId: string | null = null;
  if (input) {
    const receipt = v.object(input, ['id', 'versionId']);
    receiptDocumentId = v.uuid(receipt.id);
    receiptVersionId = v.uuid(receipt.versionId);
    requireRule(
      actor.permissions.includes('documents.metadata.read') &&
        actor.permissions.includes('documents.procurement.read'),
      'FORBIDDEN',
      'مجوز مدارک خرید وجود ندارد.',
    );
    const { data } = await documents.detail(receiptDocumentId, actor, {});
    const version = data.versions.find((item) => item.id === receiptVersionId);
    requireRule(
      data.branchId === branchId &&
        data.type.domain === 'PROCUREMENT' &&
        data.archiveStatus === 'ACTIVE' &&
        Boolean(version) &&
        !['INFECTED', 'QUARANTINED'].includes(version!.scanStatus),
      'INVALID_DOCUMENT',
      'نسخه سند برای خرید یا شعبه معتبر نیست.',
    );
  }
  return { receiptDocumentId, receiptVersionId };
}
