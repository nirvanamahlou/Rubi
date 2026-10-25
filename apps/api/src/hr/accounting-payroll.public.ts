import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@nora/database';
import { digits } from './hr.validation';

const approved = ['تأییدشده', 'تاییدشده'];
const Exact = Prisma.Decimal.clone({ precision: 60 });
function money(value: unknown) {
  const raw = typeof value === 'string' ? digits(value) : '';
  if (!/^\d{1,20}(?:\.\d{1,4})?$/.test(raw))
    throw new ConflictException('مبالغ فیش باید عدد دقیق و غیرمنفی باشند.');
  return new Exact(raw);
}
/** Existing Excel import is immutable. No inferred tax/insurance percentages. */
export function importedGross(
  rows: readonly { id: string; version: number; values: Prisma.JsonValue }[],
) {
  const find = (aliases: string[]) => {
    const matches = rows.filter((r) =>
      aliases.includes(String((r.values as string[])[3]).trim()),
    );
    if (matches.length !== 1)
      throw new ConflictException(
        'ستون یکتای ناخالص، کسورات، خالص و ارز در فیش واردشده لازم است.',
      );
    return matches[0]!;
  };
  const gross = money(
    (find(['حقوق ناخالص', 'جمع حقوق و مزایا', 'ناخالص']).values as string[])[4],
  );
  const deductions = money(
    (find(['کسورات', 'جمع کسورات']).values as string[])[4],
  );
  const net = money(
    (find(['خالص پرداختی', 'مبلغ خالص', 'خالص']).values as string[])[4],
  );
  const currency = String((find(['ارز', 'کد ارز']).values as string[])[4])
    .trim()
    .toUpperCase();
  if (
    !gross.gt(0) ||
    deductions.gt(gross) ||
    !gross.sub(deductions).eq(net) ||
    !/^[A-Z]{3}$/.test(currency)
  )
    throw new ConflictException(
      'ناخالص منهای کسورات باید دقیقاً برابر خالص فیش با ارز صریح باشد.',
    );
  return {
    gross: gross.toString(),
    deductions: deductions.toString(),
    net: net.toString(),
    currency,
    rows: rows.map((r) => ({ id: r.id, version: r.version })),
  };
}
export async function payrollSource(
  tx: Prisma.TransactionClient,
  id: string,
  grossRecordId: string,
  branchId: string,
) {
  const request = await tx.hrRecord.findFirst({
    where: {
      id,
      branchId,
      section: 'payroll',
      tab: 'paymentRequests',
      deletedAt: null,
      status: { in: approved },
    },
    select: {
      id: true,
      version: true,
      employeeId: true,
      values: true,
      amounts: { where: { field: 'field2' } },
    },
  });
  const anchor = await tx.hrRecord.findFirst({
    where: {
      id: grossRecordId,
      branchId,
      section: 'payroll',
      tab: 'importedPayslips',
      deletedAt: null,
    },
    select: { id: true, employeeId: true, values: true },
  });
  if (
    !request?.employeeId ||
    !anchor ||
    anchor.employeeId !== request.employeeId
  )
    throw new NotFoundException(
      'درخواست حقوق مصوب و فیش واردشده همان کارمند و شعبه لازم است.',
    );
  const av = anchor.values as string[],
    year = av[1]!,
    month = av[2]!;
  const rows = await tx.hrRecord.findMany({
    where: {
      branchId,
      employeeId: request.employeeId,
      section: 'payroll',
      tab: 'importedPayslips',
      deletedAt: null,
      AND: [
        { values: { path: ['1'], equals: year } },
        { values: { path: ['2'], equals: month } },
      ],
    },
    select: { id: true, version: true, values: true },
  });
  const gross = importedGross(rows),
    net = request.amounts[0];
  if (
    !net ||
    !new Exact(net.amount.toString()).eq(gross.net) ||
    net.currency !== gross.currency
  )
    throw new ConflictException(
      'مبلغ و ارز خالص درخواست مصوب با فیش واردشده یکسان نیست.',
    );
  const rv = request.values as string[];
  const peers = await tx.hrRecord.findMany({
    where: {
      branchId,
      employeeId: request.employeeId,
      section: 'payroll',
      tab: 'paymentRequests',
      deletedAt: null,
      status: { in: approved },
      values: { path: ['1'], equals: rv[1]! },
    },
    select: { id: true },
  });
  return {
    ...gross,
    id: request.id,
    version: request.version,
    employeeId: request.employeeId,
    period: rv[1]!,
    grossPeriod: `${year}-${month.padStart(2, '0')}`,
    grossRecordId: anchor.id,
    netRecordIds: peers.map((r) => r.id),
  };
}
export async function payrollSources(
  tx: Prisma.TransactionClient,
  branchId: string,
  search = '',
) {
  const [net, gross] = await Promise.all([
    tx.hrRecord.findMany({
      where: {
        branchId,
        section: 'payroll',
        tab: 'paymentRequests',
        deletedAt: null,
        ...(search
          ? {
              AND: [
                {
                  OR: [
                    {
                      employee: {
                        name: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                    { values: { path: ['1'], string_contains: search } },
                  ],
                },
              ],
            }
          : {}),
        status: { in: approved },
      },
      select: {
        id: true,
        version: true,
        values: true,
        employee: { select: { name: true, personnelCode: true } },
      },
      take: 101,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    }),
    tx.hrRecord.findMany({
      where: {
        branchId,
        section: 'payroll',
        tab: 'importedPayslips',
        deletedAt: null,
        ...(search
          ? {
              AND: [
                {
                  OR: [
                    {
                      employee: {
                        name: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                    { values: { path: ['1'], string_contains: search } },
                  ],
                },
              ],
            }
          : {}),
        OR: [
          { values: { path: ['3'], equals: 'حقوق ناخالص' } },
          { values: { path: ['3'], equals: 'جمع حقوق و مزایا' } },
          { values: { path: ['3'], equals: 'ناخالص' } },
        ],
      },
      select: {
        id: true,
        version: true,
        values: true,
        employee: { select: { name: true, personnelCode: true } },
      },
      take: 101,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    }),
  ]);
  return {
    net: net.map((r) => ({
      id: r.id,
      version: r.version,
      label: [
        r.employee?.name,
        r.employee?.personnelCode,
        ...(r.values as string[]).slice(1, 3),
      ]
        .filter(Boolean)
        .join(' · '),
    })),
    gross: gross.map((r) => ({
      id: r.id,
      label: [
        r.employee?.name,
        r.employee?.personnelCode,
        ...(r.values as string[]).slice(1, 3),
      ]
        .filter(Boolean)
        .join(' · '),
    })),
  };
}

export async function netPayrollIdentity(
  tx: Prisma.TransactionClient,
  id: string,
  branchId: string,
) {
  const row = await tx.hrRecord.findFirst({
    where: {
      id,
      branchId,
      section: 'payroll',
      tab: 'paymentRequests',
      deletedAt: null,
    },
    select: { employeeId: true, values: true },
  });
  if (!row?.employeeId)
    throw new NotFoundException('مبنای کارمند و دوره حقوق یافت نشد.');
  return {
    employeeId: row.employeeId,
    period: String((row.values as string[])[1]),
  };
}
