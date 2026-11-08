/** Source identity for runtime failure explanations; no cross-domain query shortcuts. */
export const dashboardMetricSource: Readonly<Record<string, string>> =
  Object.fromEntries(
    [
      [
        'customers.dashboard.canonical-behavior.v1',
        [
          'customer-service-usage',
          'customer-interest-coverage',
          'customer-interest-count',
        ],
      ],
      [
        'sales.dashboard.contract-currency.v1',
        [
          'gross-sales',
          'net-sales',
          'discount-amount',
          'average-sale-value',
          'new-orders',
          'finalized-sales-count',
          'employee-finalized-sales-count',
          'employee-sales-amount',
          'employee-average-sale',
          'customer-destination-demand',
        ],
      ],
      [
        'customers.dashboard.registrations.v1',
        ['registered-customers', 'customers-by-acquisition-channel'],
      ],
      ['sales.dashboard.confirmed-payments.v1', ['collected', 'refunded']],
      [
        'sales.dashboard.customer-purchase-cohorts.v1',
        ['new-customers', 'returning-customers'],
      ],
      ['customer-affairs.dashboard.leads.v1', ['new-leads']],
      [
        'tickets.dashboard.current-capacity.v1',
        [
          'active-offers',
          'remaining-capacity',
          'sell-through-rate',
          'inventory-allocated',
          'inventory-held',
          'inventory-free',
        ],
      ],
      [
        'sales.dashboard.activity-stays.v1',
        [
          'cancelled-orders',
          'employee-cancellation-count',
          'employee-contract-count',
          'hotel-reservations',
          'average-stay-length',
        ],
      ],
      [
        'documents.dashboard.compliance.v1',
        ['document-count', 'document-incomplete', 'document-expired'],
      ],
      [
        'customer-affairs.dashboard.support.v1',
        ['open-tickets', 'support-ticket-count', 'first-response-time'],
      ],
      [
        'hr.dashboard.accepted-attendance.v1',
        ['employee-workdays', 'employee-overtime'],
      ],
      [
        'customer-affairs.dashboard.attributed-calls.v1',
        ['employee-call-count', 'employee-connected-call-count'],
      ],
      ['reservations.dashboard.issued-documents.v1', ['issued-documents']],
    ].flatMap(([source, ids]) =>
      (ids as string[]).map((id) => [id, source as string]),
    ),
  );
