import { ConflictException } from '@nestjs/common';
import { Prisma, type DatabaseClient } from '@nora/database';
import { readSalesReportingEligibility } from '../sales/sales-reporting-eligibility.public';
import {
  boundedSource,
  reportColumn,
  requireSourcePermission,
  sourceBranches,
  sourceFilters,
  type ReportSource,
  type ReportSourceActor,
  type ReportSourceQuery,
} from '../common/report-source';

const reference = (snapshot: Prisma.JsonValue, fallback: string) =>
  snapshot &&
  typeof snapshot === 'object' &&
  !Array.isArray(snapshot) &&
  typeof snapshot.contractNumber === 'string'
    ? snapshot.contractNumber
    : fallback;

/** Current confirmed Sales eligibility comes only from the owning public Sales projection. */
export async function readReservationReporting(
  client: DatabaseClient,
  code: string,
  actor: ReportSourceActor,
  query: ReportSourceQuery,
): Promise<ReportSource> {
  requireSourcePermission(actor, ['reservations.read']);
  const { scalar, range } = sourceFilters(query, [
    'fromUtc',
    'toUtc',
    'branch',
    'status',
    ...(code === 'purchase_by_supplier' ? ['currencyCode'] : []),
  ]);
  const eligible = new Set(await readSalesReportingEligibility(client, actor));
  const intakes = boundedSource(
    await client.reservationIntake.findMany({
      where: {
        branchId: { in: sourceBranches(actor, scalar('branch')) },
        contractId: { in: [...eligible] },
      },
      select: {
        id: true,
        contractId: true,
        contractVersion: true,
        snapshot: true,
        status: true,
        receivedAt: true,
        workflowRevisions: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
        ticketDocuments: {
          select: { id: true, customerId: true, issuedAt: true },
        },
        servicePurchases: {
          orderBy: { version: 'desc' },
          select: {
            id: true,
            createdAt: true,
            version: true,
            amount: true,
            currencyCode: true,
            serviceKind: true,
            serviceClientKey: true,
            coveredServiceClientKeys: true,
            supplierOrganizationId: true,
            supplierBrokerId: true,
            supplierNameSnapshot: true,
          },
        },
      },
      orderBy: [{ contractVersion: 'desc' }, { id: 'asc' }],
      take: 10001,
    }),
  );
  const inRange = (at: Date) =>
    (!range.gte || at >= range.gte) && (!range.lt || at < range.lt);
  const latest = new Map<string, (typeof intakes)[number]>();
  for (const row of intakes)
    if (!latest.has(row.contractId)) latest.set(row.contractId, row);
  const statusMatches = (status: string) =>
    !scalar('status') || scalar('status') === status;
  if (code === 'purchase_by_supplier') {
    const covered = new Map<string, Set<string>>();
    const groups = new Map<
      string,
      {
        supplier: string;
        kind: string;
        currency: string;
        amount: Prisma.Decimal;
        count: number;
        at: Date;
      }
    >();
    for (const intake of intakes) {
      const seen = covered.get(intake.contractId) ?? new Set<string>();
      for (const p of intake.servicePurchases) {
        const keys =
          Array.isArray(p.coveredServiceClientKeys) &&
          p.coveredServiceClientKeys.length
            ? p.coveredServiceClientKeys.filter(
                (v): v is string => typeof v === 'string',
              )
            : [p.serviceClientKey];
        if (!keys.length)
          throw new ConflictException('پوشش خرید خدمت مشخص نیست.');
        const overlaps = keys.filter((k) => seen.has(k)).length;
        if (overlaps === keys.length) continue;
        if (overlaps)
          throw new ConflictException(
            'خرید گروهی با اصلاح جزئی هم‌پوشانی دارد؛ تطبیق خرید لازم است.',
          );
        keys.forEach((k) => seen.add(k));
        if (
          !inRange(p.createdAt) ||
          !statusMatches(latest.get(intake.contractId)!.status) ||
          (scalar('currencyCode') && p.currencyCode !== scalar('currencyCode'))
        )
          continue;
        const id = JSON.stringify([
          p.supplierBrokerId ?? p.supplierOrganizationId ?? p.id,
          p.serviceKind,
          p.currencyCode,
        ]);
        const g = groups.get(id) ?? {
          supplier: p.supplierNameSnapshot,
          kind: p.serviceKind,
          currency: p.currencyCode,
          amount: new Prisma.Decimal(0),
          count: 0,
          at: p.createdAt,
        };
        g.amount = g.amount.add(p.amount);
        g.count++;
        if (p.createdAt > g.at) g.at = p.createdAt;
        groups.set(id, g);
      }
      covered.set(intake.contractId, seen);
    }
    return {
      projection: 'reservations.reporting.registered-purchases.v1',
      chartMeasure: 'registeredAmount',
      columns: [
        reportColumn('primaryDimension', 'تأمین‌کننده'),
        reportColumn('secondaryDimension', 'نوع خدمت'),
        reportColumn('currencyCode', 'ارز'),
        reportColumn('recordCount', 'خرید جاری', 'NUMBER'),
        reportColumn('registeredAmount', 'مبلغ خرید ثبت‌شده', 'MONEY'),
      ],
      rows: [...groups].map(([id, g]) => ({
        id,
        at: g.at,
        updatedAt: g.at,
        values: {
          primaryDimension: g.supplier,
          secondaryDimension: g.kind,
          currencyCode: g.currency,
          recordCount: g.count,
          registeredAmount: g.amount.toString(),
        },
      })),
      warnings: [
        'آخرین خرید ثبت‌شده هر خدمت، در تمام نسخه‌های پرونده و بدون جمع مجدد خرید گروهی محاسبه می‌شود. قرارداد باطل‌شده حذف می‌شود. این مبلغ به معنی تأیید مالی، پرداخت یا مانده تسویه نیست. خرید بلیت عمده و قیمت پیشنهادی تأمین‌کننده در این گزارش نیست.',
      ],
    };
  }
  const rows: ReportSource['rows'][number][] = [];
  for (const intake of latest.values()) {
    if (!statusMatches(intake.status)) continue;
    const history = intakes.filter((r) => r.contractId === intake.contractId);
    const docs = history.flatMap((r) => r.ticketDocuments);
    const issuedPeople = new Set(docs.map((d) => d.customerId)).size;
    const firstReceipt = new Date(
      Math.min(...history.map((r) => r.receivedAt.getTime())),
    );
    const firstDocument = docs.length
      ? new Date(Math.min(...docs.map((d) => d.issuedAt.getTime())))
      : null;
    if (firstDocument && firstDocument < firstReceipt)
      throw new ConflictException(
        'زمان صدور مدرک پیش از دریافت پرونده است؛ تطبیق زمان لازم است.',
      );
    const at =
      code === 'tickets_manifest' || code === 'reservation_cycle_time'
        ? firstDocument
        : intake.receivedAt;
    if (!at || !inRange(at)) continue;
    const updatedAt = new Date(
      Math.max(
        intake.receivedAt.getTime(),
        ...history.flatMap((r) =>
          r.workflowRevisions.map((w) => w.createdAt.getTime()),
        ),
        ...docs.map((d) => d.issuedAt.getTime()),
      ),
    );
    rows.push({
      id: intake.contractId,
      at,
      updatedAt,
      values: {
        primaryDimension: reference(intake.snapshot, intake.contractId),
        secondaryDimension: intake.status,
        receivedAt: firstReceipt.toISOString(),
        recordCount: issuedPeople,
        firstIssuedAt: firstDocument?.toISOString() ?? 'صادر نشده',
        ...(firstDocument
          ? {
              minutesToFirstDocument: (
                (firstDocument.getTime() - firstReceipt.getTime()) /
                60000
              ).toFixed(2),
            }
          : {}),
      },
    });
  }
  return {
    projection: 'reservations.reporting.delivery.v1',
    chartMeasure:
      code === 'reservation_cycle_time'
        ? 'minutesToFirstDocument'
        : 'recordCount',
    columns: [
      reportColumn('primaryDimension', 'شماره قرارداد'),
      reportColumn('secondaryDimension', 'وضعیت ورود رزرواسیون'),
      reportColumn('receivedAt', 'اولین دریافت UTC'),
      reportColumn('recordCount', 'مسافر دارای مدرک صادرشده', 'NUMBER'),
      reportColumn('firstIssuedAt', 'اولین صدور مدرک UTC'),
      ...(code === 'reservation_cycle_time'
        ? [
            reportColumn(
              'minutesToFirstDocument',
              'دقیقه تا اولین مدرک',
              'NUMBER',
            ),
          ]
        : []),
    ],
    rows,
    warnings: [
      'هر قرارداد جاری تأییدشده یک‌بار شمرده می‌شود؛ ابطال‌ها حذف‌اند. مدرک داخلی ثبت‌شده به معنی PNR، صدور Provider یا مجوز تحویل مالی نیست. زمان‌ها UTC و فاصله زمانی تا اولین مدرک واقعی است؛ نبود مدرک به معنی صفر دقیقه نیست.',
    ],
  };
}
