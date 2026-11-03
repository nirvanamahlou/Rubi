import type { DatabaseClient } from '@nora/database';
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

/** Latest native rate-pack versions only; keep separate periods/currencies comparable. */
export async function readHotelRateReporting(
  client: DatabaseClient,
  actor: ReportSourceActor,
  query: ReportSourceQuery,
): Promise<ReportSource> {
  requireSourcePermission(actor, ['reservations.read']);
  const { scalar, range } = sourceFilters(query, [
    'fromUtc',
    'toUtc',
    'branch',
    'currencyCode',
  ]);
  const packs = boundedSource(
    await client.reservationHotelRatePack.findMany({
      where: {
        branchId: { in: sourceBranches(actor, scalar('branch')) },
        archivedAt: null,
        checkIn: range,
        ...(scalar('currencyCode')
          ? { currency: scalar('currencyCode')! }
          : {}),
      },
      select: {
        id: true,
        currentVersion: true,
        updatedAt: true,
        versions: {
          select: {
            id: true,
            version: true,
            checkIn: true,
            checkOut: true,
            createdAt: true,
            rows: {
              select: {
                id: true,
                hotelName: true,
                brokerName: true,
                base: true,
                currency: true,
                roomRates: { select: { id: true } },
              },
            },
          },
        },
      },
      take: 10001,
    }),
  );
  const rows = boundedSource(
    packs.flatMap((p) =>
      p.versions
        .filter((v) => v.version === p.currentVersion)
        .flatMap((v) =>
          v.rows.map((r) => ({
            id: r.id,
            at: v.checkIn,
            updatedAt: p.updatedAt,
            values: {
              primaryDimension: r.hotelName,
              secondaryDimension: r.brokerName,
              checkIn: v.checkIn.toISOString().slice(0, 10),
              checkOut: v.checkOut.toISOString().slice(0, 10),
              currencyCode: r.currency,
              baseRate: r.base.toString(),
              roomTypes: r.roomRates.length,
            },
          })),
        ),
    ),
  );
  return {
    projection: 'reservations.reporting.hotel-base-rates.v1',
    chartMeasure: 'baseRate',
    rows,
    columns: [
      reportColumn('primaryDimension', 'هتل'),
      reportColumn('secondaryDimension', 'کارگزار'),
      reportColumn('checkIn', 'شروع اقامت'),
      reportColumn('checkOut', 'پایان اقامت'),
      reportColumn('currencyCode', 'ارز'),
      reportColumn('baseRate', 'نرخ پایه ثبت‌شده', 'MONEY'),
      reportColumn('roomTypes', 'نوع اتاق ثبت‌شده', 'NUMBER'),
    ],
    warnings: [
      'بازه تاریخ بر اساس شروع اقامت است. فقط نسخه جاری بسته نرخِ بایگانی‌نشده نمایش داده می‌شود؛ نرخ پایه، نرخ نهایی اتاق/اشغال یا قیمت فروش نیست. بازه، اتاق و ارز متفاوت را هم‌ارز مقایسه نکنید.',
    ],
  };
}
