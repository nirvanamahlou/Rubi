import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  PayrollWorksheetFinanceSource,
  PayrollWorksheetStatus,
} from '@nora/contracts';
import type { Prisma } from '@nora/database';

export const PAYROLL_WORKSHEET_KIND = 'PAYROLL_WORKSHEET';
type Reader = Pick<Prisma.TransactionClient, 'financeOperationalRequest'>;
export async function payrollWorksheetFinanceStates(
  tx: Reader,
  ids: readonly string[],
  branches: readonly string[],
) {
  const rows = ids.length
    ? await tx.financeOperationalRequest.findMany({
        where: {
          kind: PAYROLL_WORKSHEET_KIND,
          hrRecordId: { in: [...ids] },
          branchId: { in: [...branches] },
        },
        select: { id: true, hrRecordId: true, status: true },
      })
    : [];
  return new Map(
    rows.map((row) => [
      row.hrRecordId!,
      {
        financeRequestId: row.id,
        status:
          (
            {
              NEW: 'PENDING_FINANCE',
              UNDER_REVIEW: 'PENDING_FINANCE',
              APPROVED: 'APPROVED',
              CORRECTION_REQUIRED: 'CORRECTION_REQUIRED',
              REJECTED: 'REJECTED',
              CANCELLED: 'CANCELLED',
            } as Record<string, PayrollWorksheetStatus>
          )[row.status] ?? 'PENDING_FINANCE',
      },
    ]),
  );
}

/** Finance owns this request and its immutable history; HR supplies only a frozen aggregate. */
export async function submitPayrollWorksheet(
  tx: Prisma.TransactionClient,
  source: PayrollWorksheetFinanceSource,
  actor: AuthenticatedActor,
) {
  if (
    !actor.branchIds.includes(source.branchId) ||
    !(['hr.manage', 'hr.approve', 'hr.sensitive'] as const).every((p) =>
      actor.permissions.includes(p),
    )
  )
    throw new ForbiddenException('مجوز ارسال حقوق به مالی لازم است.');
  if (
    !/^\d{1,20}$/.test(source.amount) ||
    BigInt(source.amount) <= 0n ||
    BigInt(source.amount) >= 10n ** 20n ||
    source.currencyCode !== 'IRR' ||
    !Number.isInteger(source.version) ||
    source.version < 1 ||
    !Number.isInteger(source.rowCount) ||
    source.rowCount < 1 ||
    source.rowCount > 500
  )
    throw new BadRequestException(
      'مبلغ قابل پرداخت حقوق باید مثبت و در محدوده مجاز باشد.',
    );
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`payroll-worksheet:${source.id}`}, 0))::text`;
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(source))
    .digest('hex');
  const previous = await tx.financeOperationalRequest.findUnique({
    where: { hrRecordId: source.id },
    include: { revisions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  if (
    previous &&
    (previous.kind !== PAYROLL_WORKSHEET_KIND ||
      previous.branchId !== source.branchId)
  )
    throw new ConflictException('منبع درخواست مالی حقوق معتبر نیست.');
  if (previous?.createFingerprint === fingerprint) return previous;
  if (
    previous &&
    (!['CORRECTION_REQUIRED', 'REJECTED'].includes(previous.status) ||
      !previous.revisions[0]?.cumulativePaid.isZero())
  )
    throw new ConflictException('درخواست حقوق در مالی قابل تغییر نیست.');
  const dueAt = new Date();
  const version = previous ? previous.version + 1 : 1;
  const data = {
    requesterId: actor.userId,
    amount: source.amount,
    currencyCode: source.currencyCode,
    sourceVersion: source.version,
    status: 'NEW',
    createFingerprint: fingerprint,
    dueAt,
    title: `حقوق ${source.period}`,
    party: 'کارکنان شعبه',
    reference: source.period,
    description: `جدول حقوق ${source.period} — ${source.rowCount} ردیف`,
    payrollPeriod: source.period,
  };
  let request;
  if (previous) {
    const changed = await tx.financeOperationalRequest.updateMany({
      where: {
        id: previous.id,
        version: previous.version,
        status: previous.status,
      },
      data: { ...data, version: { increment: 1 } },
    });
    if (changed.count !== 1)
      throw new ConflictException('نسخه درخواست مالی تغییر کرده است.');
    request = await tx.financeOperationalRequest.findUniqueOrThrow({
      where: { id: previous.id },
    });
  } else {
    request = await tx.financeOperationalRequest.create({
      data: {
        ...data,
        id: source.id,
        branchId: source.branchId,
        kind: PAYROLL_WORKSHEET_KIND,
        hrRecordId: source.id,
      },
    });
  }
  await tx.financeOperationalRevision.create({
    data: {
      id: randomUUID(),
      requestId: request.id,
      actorId: actor.userId,
      version,
      action: previous ? 'RESUBMIT' : 'CREATE',
      fromStatus: previous?.status ?? null,
      toStatus: 'NEW',
      reason: previous
        ? 'ارسال جدول اصلاح‌شده حقوق از منابع انسانی'
        : 'ارسال جدول حقوق از منابع انسانی',
      fingerprint,
      snapshot: { ...source },
      remainingAmount: source.amount,
    },
  });
  return request;
}

export async function assertPayrollWorksheetCanReopen(
  tx: Prisma.TransactionClient,
  id: string,
  branches: readonly string[],
) {
  const previous = await tx.financeOperationalRequest.findUnique({
    where: { hrRecordId: id },
  });
  if (!previous) return;
  if (
    previous.kind !== PAYROLL_WORKSHEET_KIND ||
    !branches.includes(previous.branchId)
  )
    throw new ForbiddenException('دسترسی درخواست مالی حقوق وجود ندارد.');
  await tx.$queryRaw`SELECT id FROM finance_operational_requests WHERE id=${previous.id}::uuid FOR UPDATE`;
  const current = await tx.financeOperationalRequest.findUniqueOrThrow({
    where: { id: previous.id },
    include: { revisions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  if (
    !['CORRECTION_REQUIRED', 'REJECTED'].includes(current.status) ||
    !current.revisions[0]?.cumulativePaid.isZero()
  )
    throw new ConflictException(
      'جدول در انتظار مالی یا تأییدشده قابل بازگشایی نیست.',
    );
}
