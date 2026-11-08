import { dashboardDimensionKey } from '../common/dashboard-dimensions';
import type { DatabaseClient } from '@nora/database';
import type {
  DashboardObservation,
  DashboardSourceQuery,
  DashboardSourceResult,
} from '../common/dashboard-source';
import { unsupportedDashboardFilters } from '../common/dashboard-source';
import { readSalesCustomerBehavior } from '../sales/sales-customer-behavior.public';
import { readLeadInterestSignals } from '../customer-affairs/lead-interest-signals.public';
import { reportingCityLabels } from '../master-data/reporting-cities.public';

/** Customers owns canonical identity eligibility and deduplication across domain signals. */
export async function readCustomerBehaviorDashboard(
  client: DatabaseClient,
  q: DashboardSourceQuery,
): Promise<DashboardSourceResult> {
  const source = 'customers.dashboard.canonical-behavior.v1';
  if (
    !q.actor.permissions.includes('customers.read') ||
    !q.actor.branchIds.length
  )
    return { source, state: 'forbidden', metrics: {} };
  if (
    unsupportedDashboardFilters(q, ['branch']) ||
    !['effective', 'paid'].includes(q.dateBasis)
  )
    return {
      source,
      state: 'unsupported',
      reason: 'CUSTOMER_COHORT_FILTER_UNSUPPORTED',
      metrics: {},
    };
  const sales = await readSalesCustomerBehavior(client, q);
  if (sales.state !== 'ready') return { source, ...sales, metrics: {} };
  const leads = await readLeadInterestSignals(client, q);
  const signals = [
    ...sales.signals,
    ...(leads.state === 'ready' ? leads.signals : []),
  ];
  const ids = [...new Set(signals.map((s) => s.customerId))];
  if (ids.length > 10000)
    return {
      source,
      state: 'unavailable',
      reason: 'SOURCE_ROW_LIMIT',
      metrics: {},
    };
  const customers = ids.length
    ? await client.customer.findMany({
        where: {
          id: { in: ids },
          ownerBranchId: {
            in: q.branchId
              ? q.actor.branchIds.filter((b) => b === q.branchId)
              : [...q.actor.branchIds],
          },
          isCustomer: true,
          mergedIntoId: null,
        },
        select: { id: true },
      })
    : [];
  const canonical = new Set(customers.map((c) => c.id));
  const cities = await reportingCityLabels(
    client,
    signals.flatMap((s) => (s.destinationId ? [s.destinationId] : [])),
  );
  const services: Readonly<Record<string, string>> = {
    FLIGHT: 'پرواز',
    HOTEL: 'هتل',
    TOUR: 'تور',
    TRANSFER: 'ترانسفر',
    VISA: 'ویزا',
    INSURANCE: 'بیمه',
    BUS: 'اتوبوس',
    TRAIN: 'قطار',
    CIP: 'تشریفات فرودگاهی',
    OTHER: 'سایر خدمات',
  };
  const pairs = new Map<string, DashboardObservation>(),
    interested = new Map<string, DashboardObservation>(),
    categories = new Map<string, DashboardObservation>();
  for (const s of [...sales.signals].sort(
    (a, b) => a.at.getTime() - b.at.getTime(),
  ))
    if (
      canonical.has(s.customerId) &&
      s.service &&
      !pairs.has(JSON.stringify([s.customerId, s.service]))
    )
      pairs.set(JSON.stringify([s.customerId, s.service]), {
        at: s.at,
        value: '1',
        dimensions: { service: services[s.service] ?? s.service },
      });
  for (const s of [...signals].sort((a, b) => a.at.getTime() - b.at.getTime()))
    if (canonical.has(s.customerId)) {
      if (
        !interested.has(s.customerId) &&
        (s.service || (s.destinationId && cities.has(s.destinationId)))
      )
        interested.set(s.customerId, { at: s.at, value: '1' });
      const values = [
        ...(s.service
          ? [
              {
                key: dashboardDimensionKey('interest-service', s.service),
                label: 'خدمت · ' + (services[s.service] ?? s.service),
              },
            ]
          : []),
        ...(s.destinationId && cities.has(s.destinationId)
          ? [
              {
                key: dashboardDimensionKey('interest-city', s.destinationId),
                label: 'مقصد · ' + cities.get(s.destinationId)!,
              },
            ]
          : []),
      ];
      for (const value of values)
        if (!categories.has(JSON.stringify([s.customerId, value.key])))
          categories.set(JSON.stringify([s.customerId, value.key]), {
            at: s.at,
            value: '1',
            dimensions: { interest: value.label },
            dimensionKeys: { interest: value.key },
          });
    }
  return {
    source,
    state: 'ready',
    ...(leads.state !== 'ready'
      ? {
          unavailableMetrics: {
            'customer-interest-coverage':
              leads.state === 'forbidden'
                ? 'SOURCE_PERMISSION_REQUIRED'
                : (leads.reason ?? 'SOURCE_READ_FAILED'),
            'customer-interest-count':
              leads.state === 'forbidden'
                ? 'SOURCE_PERMISSION_REQUIRED'
                : (leads.reason ?? 'SOURCE_READ_FAILED'),
          },
        }
      : {}),
    metrics: {
      'customer-service-usage': {
        kind: 'count',
        unit: 'مشتری/نوع خدمت',
        aggregation:
          'مشتری اصلی و نوع خدمت در خرید موفق دارای پرداخت تأییدشده، یک‌بار در هر نوع؛ خرید لغوشده و استرداد نامشخص خارج است.',
        observations: [...pairs.values()],
      },
      ...(leads.state === 'ready'
        ? {
            'customer-interest-coverage': {
              kind: 'count' as const,
              aggregation:
                'مشتری اصلی با درخواست ساختاریافته یا خرید موفق؛ هر مشتری در مجموع یک‌بار و بدون حدس از متن آزاد.',
              observations: [...interested.values()],
            },
            'customer-interest-count': {
              kind: 'count' as const,
              aggregation:
                'مشتری اصلی در هر مقصد یا نوع خدمت یکتا؛ دسته‌ها می‌توانند مشتری مشترک داشته باشند.',
              observations: [...categories.values()],
            },
          }
        : {}),
    },
  };
}
