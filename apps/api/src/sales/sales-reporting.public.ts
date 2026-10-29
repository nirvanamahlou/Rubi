import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type {
  Prisma,
  DatabaseClient,
  SalesContractStatus,
} from '@nora/database';
import { calculateSalesBalances } from './sales.domain';

export interface SalesReportingQuery {
  filters: Readonly<Record<string, string | readonly string[]>>;
  legalEntityId?: string;
}
export interface SalesReportingActor {
  userId: string;
  branchIds: readonly string[];
  permissions: readonly string[];
}

/** Sales-owned, contract/currency read model. No passenger/service money join. */
export async function readSalesReportingProjection(
  client: DatabaseClient,
  actor: SalesReportingActor,
  query: SalesReportingQuery,
  pipeline = false,
) {
  const all = actor.permissions.includes('sales.contracts.read.all');
  const branch = actor.permissions.includes('sales.contracts.read.branch');
  const own = actor.permissions.includes('sales.contracts.read.own');
  if (!all && ((!branch && !own) || !actor.branchIds.length))
    throw new ForbiddenException('دسترسی گزارش مجاز نیست.');
  const allowed = new Set([
    'fromUtc',
    'toUtc',
    'branchId',
    'ownerUserId',
    'branch',
    'expert',
    'currencyCode',
    'status',
  ]);
  if (
    query.legalEntityId ||
    Object.entries(query.filters).some(
      ([key, value]) =>
        (Array.isArray(value) ? value.length > 0 : Boolean(value)) &&
        !allowed.has(key),
    )
  )
    throw new BadRequestException(
      'فیلتر انتخاب‌شده در منبع این گزارش پشتیبانی نمی‌شود.',
    );
  const scalar = (key: string) => {
    const value = query.filters[key];
    if (value !== undefined && typeof value !== 'string')
      throw new BadRequestException('فیلتر نامعتبر است.');
    return typeof value === 'string' && value ? value : undefined;
  };
  if (
    (scalar('branchId') &&
      scalar('branch') &&
      scalar('branchId') !== scalar('branch')) ||
    (scalar('ownerUserId') &&
      scalar('expert') &&
      scalar('ownerUserId') !== scalar('expert'))
  )
    throw new BadRequestException('فیلتر نامعتبر است.');
  const branchId = scalar('branchId') ?? scalar('branch'),
    ownerUserId = scalar('ownerUserId') ?? scalar('expert');
  const currencyCode = scalar('currencyCode'),
    status = scalar('status');
  if (
    status &&
    ![
      'DRAFT',
      'CONFIRMED',
      'SENT_TO_RESERVATIONS',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
    ].includes(status)
  )
    throw new BadRequestException('فیلتر نامعتبر است.');
  const scope: Prisma.SalesContractWhereInput = all
    ? {}
    : {
        branchId: { in: [...actor.branchIds] },
        ...(!branch ? { ownerUserId: actor.userId } : {}),
      };
  const rows = await client.salesContract.findMany({
    where: {
      AND: [
        scope,
        ...(branchId ? [{ branchId }] : []),
        ...(ownerUserId ? [{ ownerUserId }] : []),
        ...(pipeline
          ? []
          : [
              {
                status: {
                  in: [
                    'CONFIRMED',
                    'SENT_TO_RESERVATIONS',
                    'IN_PROGRESS',
                    'COMPLETED',
                  ] as SalesContractStatus[],
                },
                confirmedAt: { not: null },
              },
            ]),
        ...(status ? [{ status: status as SalesContractStatus }] : []),
        {
          createdAt: {
            ...(scalar('fromUtc') ? { gte: new Date(scalar('fromUtc')!) } : {}),
            ...(scalar('toUtc') ? { lt: new Date(scalar('toUtc')!) } : {}),
          },
        },
      ],
    },
    select: {
      id: true,
      contractNumber: true,
      branchId: true,
      ownerUserId: true,
      originId: true,
      destinationId: true,
      status: true,
      settlementStatus: true,
      reservationStatus: true,
      createdAt: true,
      updatedAt: true,
      departureDate: true,
      _count: { select: { passengers: true } },
      services: { select: { kind: true } },
      priceComponents: {
        select: { type: true, title: true, amount: true, currencyCode: true },
      },
      payments: {
        where: actor.permissions.includes('sales.payments.read')
          ? {}
          : { id: { in: [] } },
        select: { amount: true, currencyCode: true, status: true },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    take: 10001,
  });
  if (rows.length > 10000)
    throw new BadRequestException(
      'بازه را کوچک‌تر کنید؛ گزارش بیش از ۱۰۰۰۰ قرارداد دارد.',
    );
  if (rows.some((row) => !row.priceComponents.length))
    throw new ConflictException(
      'قیمت برخی قراردادها کامل نیست؛ گزارش مبلغ قابل محاسبه نیست.',
    );
  return rows.flatMap((row) => {
    const balances = calculateSalesBalances(
      row.priceComponents.map((p) => ({ ...p, amount: p.amount.toString() })),
      actor.permissions.includes('sales.payments.read')
        ? row.payments.map((p) => ({ ...p, amount: p.amount.toString() }))
        : [],
    );
    return balances
      .filter(
        (balance) => !currencyCode || balance.currencyCode === currencyCode,
      )
      .map((balance) => ({
        id: row.id,
        contractNumber: row.contractNumber,
        branchId: row.branchId,
        ownerUserId: row.ownerUserId,
        originId: row.originId,
        destinationId: row.destinationId,
        status: row.status,
        reservationStatus: row.reservationStatus,
        passengerCount: row._count.passengers,
        serviceKinds: [
          ...new Set(row.services.map((service) => service.kind)),
        ].sort(),
        occurredAt: row.createdAt,
        dataAsOf: row.updatedAt,
        departureDate: row.departureDate,
        currencyCode: balance.currencyCode,
        salesAmount: balance.amount,
        outstanding: actor.permissions.includes('sales.payments.read')
          ? balance.outstanding
          : null,
      }));
  });
}
