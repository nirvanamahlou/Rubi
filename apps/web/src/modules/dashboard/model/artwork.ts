import type { DashboardVisualKind } from './registry';

// Atlas order is row-major and deliberately independent of locale and KPI values.
export const dashboardArtworkNames = [
  'sales',
  'receipt',
  'profit',
  'collection',
  'refund',
  'receivables',
  'contract',
  'customers',
  'conversion',
  'trend',
  'channels',
  'services',
  'expenses',
  'balance',
  'commission',
  'ticket',
  'cancellation',
  'calendar',
  'tasks',
  'support',
  'hotel',
  'flight',
  'risk',
  'performance',
] as const;
export type DashboardArtworkName = (typeof dashboardArtworkNames)[number];

const kpiGroups: Record<DashboardArtworkName, readonly string[]> = {
  sales: [
    'gross-sales',
    'agency-sales',
    'attributed-sales',
    'finalized-sales-count',
    'average-sale-value',
    'employee-finalized-sales-count',
    'employee-sales-amount',
    'employee-average-sale',
    'campaign-roas',
  ],
  receipt: [
    'net-sales',
    'issued-documents',
    'incomplete-hr-records',
    'consent-coverage',
  ],
  profit: ['gross-profit', 'net-profit', 'agency-profit'],
  collection: ['collected', 'collection-rate'],
  refund: ['refunded', 'refund-rate'],
  receivables: [
    'receivables',
    'provider-payables',
    'overdue-balance',
    'due-checks',
    'awaiting-payment',
    'pending-supplier-payments',
    'supplier-payment-wait',
    'expiring-guarantees',
  ],
  contract: ['new-orders', 'employee-contract-count'],
  customers: [
    'new-customers',
    'returning-customers',
    'lead-volume',
    'new-leads',
    'lead-growth-rate',
    'customer-interest-coverage',
    'employee-lead-count',
  ],
  conversion: [
    'lead-conversion-rate',
    'campaign-conversion',
    'employee-lead-conversion',
  ],
  trend: [],
  channels: ['customers-by-acquisition-channel'],
  services: ['customer-service-usage'],
  expenses: ['operating-expenses', 'supplier-spend', 'advertising-spend'],
  balance: ['account-balance'],
  commission: ['paid-commissions', 'discount-amount'],
  ticket: [
    'awaiting-issue',
    'paid-not-issued',
    'issue-success-rate',
    'tour-reservations',
  ],
  cancellation: [
    'cancelled-orders',
    'cancelled-reservations',
    'ticket-cancellation-rate',
    'employee-cancellation-count',
  ],
  calendar: [
    'pipeline-age',
    'employee-workdays',
    'employee-leave',
    'employee-overtime',
    'expiring-hr-records',
  ],
  tasks: ['overdue-tasks', 'overdue-followups', 'employee-followup-count'],
  support: ['open-tickets', 'first-response-time', 'employee-call-count'],
  hotel: ['hotel-reservations', 'average-stay-length'],
  flight: [
    'average-ticket-price',
    'customer-destination-demand',
    'active-offers',
  ],
  risk: [
    'reservation-failure-rate',
    'delivery-blockers',
    'sla-breach-rate',
    'low-satisfaction',
    'credit-at-risk',
  ],
  performance: [
    'sell-through-rate',
    'remaining-capacity',
    'low-capacity-offers',
    'tour-remaining-capacity',
    'tour-sell-through-rate',
    'employee-performance',
    'employee-sales-rank',
  ],
};
const chartGroups: Record<DashboardArtworkName, readonly string[]> = {
  sales: [
    'employee-sales-count-by-agent',
    'employee-sales-amount-by-agent',
    'employee-average-sale-by-agent',
    'partner-performance',
    'campaign-value',
  ],
  receipt: [
    'collection-status',
    'document-quality-overview',
    'report-data-quality-overview',
    'consent-coverage-chart',
  ],
  profit: ['gross-profit-by-service'],
  collection: ['treasury-flow'],
  refund: ['refund-by-service'],
  receivables: [
    'executive-cash-exposure',
    'overdue-counterparties',
    'due-checks-queue',
    'supplier-payment-status',
    'supplier-action-queue',
    'customer-debt-aging',
  ],
  contract: ['employee-contracts-by-agent', 'partner-action-queue'],
  customers: [
    'executive-customer-retention',
    'customer-interest-distribution',
    'employee-leads-by-agent',
  ],
  conversion: [
    'executive-lead-conversion',
    'commercial-pipeline',
    'issue-funnel',
    'crm-funnel',
    'lead-source-conversion',
    'campaign-performance',
    'employee-conversion-by-agent',
    'customer-growth-overview',
    'customer-source-quality',
  ],
  trend: [
    'executive-trend',
    'executive-lead-acquisition',
    'finalized-sales-trend',
    'sales-weekday-pattern',
    'average-sale-trend',
    'sales-channel-trend',
    'sales-collection-trend',
    'average-ticket-price-trend',
    'finance-profit-trend',
    'customer-acquisition-channel-trend',
    'support-time-trend',
    'workforce-performance',
    'discount-trend',
    'expense-trend',
    'paid-commission-trend',
  ],
  channels: ['sales-channel', 'customer-acquisition-channel-mix'],
  services: [
    'executive-sales-by-service',
    'service-type',
    'service-sales-portfolio',
    'customer-service-distribution',
  ],
  expenses: [
    'supplier-spend-share',
    'expense-structure',
    'advertising-spend-by-channel',
  ],
  balance: [],
  commission: ['discount-analysis', 'paid-commission-by-recipient'],
  ticket: ['tour-sales-ranking'],
  cancellation: [
    'executive-reservation-cancellations',
    'ticket-cancellation-analysis',
    'employee-cancellations-by-agent',
  ],
  calendar: ['inventory-departure-curve', 'workforce-compliance-queue'],
  tasks: [
    'inventory-action-queue',
    'crm-followup-queue',
    'support-recovery-queue',
    'employee-followups-by-agent',
    'task-automation-queue',
  ],
  support: ['support-breakdown', 'employee-calls-by-agent'],
  hotel: [
    'hotel-sales-ranking',
    'popular-hotel-cities',
    'average-stay-analysis',
    'hotel-rate-comparison',
  ],
  flight: [
    'sales-destination-ranking',
    'sales-country-ranking',
    'airline-sales-performance',
    'route-sales-performance',
    'customer-destination-distribution',
  ],
  risk: [
    'executive-exceptions',
    'issue-alerts',
    'provider-failure-rate',
    'counterparty-exposure',
    'customer-trust-guardrails',
    'partner-credit-risk',
  ],
  performance: [
    'agent-ranking',
    'inventory-capacity',
    'tour-capacity-performance',
    'workforce-capacity',
    'employee-performance-ranking',
  ],
};

function indexGroups(groups: Record<DashboardArtworkName, readonly string[]>) {
  return new Map(
    Object.entries(groups).flatMap(([name, ids]) =>
      ids.map((id) => [id, name as DashboardArtworkName] as const),
    ),
  );
}
export const dashboardKpiArtworkById = indexGroups(kpiGroups);
export const dashboardChartArtworkById = indexGroups(chartGroups);

export function dashboardKpiArtwork(id: string): DashboardArtworkName {
  return dashboardKpiArtworkById.get(id) ?? 'performance';
}

export function dashboardChartArtwork(
  id: string,
  kind: DashboardVisualKind,
): DashboardArtworkName {
  return (
    dashboardChartArtworkById.get(id) ??
    (kind === 'line'
      ? 'trend'
      : kind === 'funnel'
        ? 'conversion'
        : kind === 'queue'
          ? 'tasks'
          : kind === 'table'
            ? 'receipt'
            : 'services')
  );
}

// Tight, reviewed source regions keep the full silhouettes inside the viewport.
export function dashboardArtworkViewBox(name: DashboardArtworkName) {
  const index = dashboardArtworkNames.indexOf(name);
  const row = Math.floor(index / 6);
  const rows = [
    [32, 256],
    [308, 236],
    [548, 224],
    [780, 224],
  ] as const;
  const [y, height] = rows[row]!;
  return [(index % 6) * 256, y, 256, height].join(' ');
}
