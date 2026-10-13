import { describe, expect, it, vi } from 'vitest';
import {
  assistantActionSchema,
  assistantFilteredActionSchema,
  loadAssistantAction,
} from './model';

const snapshot = {
  version: 1,
  generatedAt: '2026-10-12T08:00:00.000Z',
  scope: 'SELF',
  sources: ['calendar', 'notes', 'procurement'].map((id) => ({
    id,
    status: 'READY',
    asOf: '2026-10-12T08:00:00.000Z',
    truncated: false,
  })),
  followUps: [
    {
      id: 'calendar:synthetic',
      title: 'Synthetic',
      source: 'calendar',
      dueAt: '2026-10-11T08:00:00.000Z',
      reason: 'OVERDUE',
      href: '/workbench?tab=calendar',
    },
  ],
  truncated: false,
  capabilities: {
    forecasting: false,
    news: false,
    scenarios: false,
    llm: false,
    writes: false,
  },
};
const daily = {
  version: 1,
  action: 'daily-summary',
  status: 'READY',
  scope: 'SELF',
  coverage: { horizonDays: 7, limit: 30, includesOverdue: true },
  counts: { visible: 1, overdue: 1, dueSoon: 0, assigned: 0 },
  recommendations: [
    {
      followUpId: 'calendar:synthetic',
      ruleId: 'OVERDUE_V1',
      priority: 'HIGH',
    },
  ],
  snapshot,
};

describe('assistant evidence contract', () => {
  it('keeps contractual balances separate, preserves precision and rejects unsafe links or inconsistent money', () => {
    const balance = {
      currencyCode: 'USD',
      amount: '9007199254740993.0001',
      confirmedPaid: '20',
      pendingFinance: '5',
      outstanding: '9007199254740973.0001',
    };
    const report = {
      version: 1,
      source: 'sales.assistant.contract-balances.v1',
      scope: 'ALL_AUTHORIZED_SALES',
      observedAt: '2026-10-12T08:00:00Z',
      sourceUpdatedAt: null,
      contractCount: 1,
      totals: [balance],
      items: [
        {
          contractId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contractNumber: 'SYNTHETIC',
          href: '/sales',
          balances: [balance],
        },
      ],
      coverage: {
        rowLimit: 5000,
        itemLimit: 30,
        itemsTruncated: false,
        basis: 'CURRENT_CONFIRMED_CONTRACTS',
        refundsIncluded: false,
      },
      unavailable: [
        'ACCOUNTING_RECEIVABLES_SOURCE_PENDING',
        'DUE_SCHEDULE_SOURCE_PENDING',
        'REFUND_ADJUSTMENT_SOURCE_PENDING',
      ],
    };
    const envelope = {
      version: 1,
      action: 'receivables-follow-up',
      status: 'PARTIAL',
      scope: 'ALL_AUTHORIZED_SALES',
      report,
    };
    expect(assistantActionSchema.safeParse(envelope).success).toBe(true);
    expect(
      assistantActionSchema.safeParse({
        ...envelope,
        report: { ...report, totals: [{ ...balance, outstanding: '0' }] },
      }).success,
    ).toBe(false);
    expect(
      assistantActionSchema.safeParse({
        ...envelope,
        report: {
          ...report,
          items: [{ ...report.items[0], href: 'https://evil.invalid' }],
        },
      }).success,
    ).toBe(false);
    expect(
      assistantActionSchema.safeParse({
        ...envelope,
        report: {
          ...report,
          coverage: { ...report.coverage, refundsIncluded: true },
        },
      }).success,
    ).toBe(false);
    expect(
      assistantActionSchema.safeParse({
        ...daily,
        corporate: {
          sales: { status: 'DENIED' },
          balances: { status: 'READY', report },
        },
      }).success,
    ).toBe(true);
  });
  it('accepts only real-source partial sales and rejects demo/false count/label claims', () => {
    const current = {
      startUtc: '2026-10-04T20:30:00.000Z',
      endUtc: '2026-10-11T20:30:00.000Z',
      contractCount: 1,
      passengerCount: 2,
      routes: [
        {
          originId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          destinationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          originName: 'Synthetic origin',
          destinationName: 'Synthetic destination',
          contractCount: 1,
          passengerCount: 2,
        },
      ],
    };
    const report = {
      version: 1,
      source: 'sales.assistant.weekly.v1',
      scope: 'ALL_AUTHORIZED_SALES',
      timeBasis: 'CREATED_AT',
      timeZone: 'Asia/Tehran',
      observedAt: '2026-10-12T08:00:00Z',
      sourceUpdatedAt: null,
      routeNamesComplete: true,
      current,
      previous: {
        startUtc: '2026-09-27T20:30:00.000Z',
        endUtc: current.startUtc,
        contractCount: 0,
        passengerCount: 0,
        routes: [],
      },
      coverage: {
        rowLimit: 5000,
        routeBasis: 'PRIMARY_CONTRACT_ROUTE',
        truncated: false,
      },
      unavailable: [
        'NET_SALES_REFUND_SOURCE_PENDING',
        'CONTACT_COHORT_SOURCE_PENDING',
        'MULTI_ROUTE_PROJECTION_PENDING',
      ],
    };
    const envelope = {
      version: 1,
      action: 'sales-analysis',
      status: 'PARTIAL',
      scope: 'ALL_AUTHORIZED_SALES',
      report,
    };
    expect(assistantActionSchema.safeParse(envelope).success).toBe(true);
    expect(
      assistantActionSchema.safeParse({
        ...envelope,
        report: { ...report, source: 'reporting.travel.facts.v1' },
      }).success,
    ).toBe(false);
    expect(
      assistantActionSchema.safeParse({
        ...envelope,
        report: { ...report, current: { ...current, contractCount: 2 } },
      }).success,
    ).toBe(false);
    expect(
      assistantActionSchema.safeParse({
        ...envelope,
        report: { ...report, routeNamesComplete: false },
      }).success,
    ).toBe(false);
  });
  it('accepts reconciled counts and rejects fabricated totals, rules and unsafe links', () => {
    expect(assistantActionSchema.safeParse(daily).success).toBe(true);
    expect(
      assistantActionSchema.safeParse({
        ...daily,
        counts: { ...daily.counts, overdue: 2 },
      }).success,
    ).toBe(false);
    expect(
      assistantActionSchema.safeParse({
        ...daily,
        recommendations: [{ ...daily.recommendations[0], priority: 'LOW' }],
      }).success,
    ).toBe(false);
    expect(
      assistantActionSchema.safeParse({
        ...daily,
        snapshot: {
          ...snapshot,
          followUps: [
            { ...snapshot.followUps[0], href: 'https://external.example/' },
          ],
        },
      }).success,
    ).toBe(false);
  });
  it('keeps missing-source and business-gate outcomes distinct', () => {
    const missing = {
      ...daily,
      snapshot: {
        ...snapshot,
        sources: snapshot.sources.map((source) =>
          source.id === 'notes'
            ? { ...source, status: 'UNAVAILABLE', asOf: null }
            : source,
        ),
      },
    };
    expect(assistantActionSchema.safeParse(missing).success).toBe(false);
    expect(
      assistantActionSchema.safeParse({ ...missing, status: 'PARTIAL' })
        .success,
    ).toBe(true);
    expect(
      assistantActionSchema.safeParse({
        ...missing,
        status: 'PARTIAL',
        snapshot: {
          ...missing.snapshot,
          sources: missing.snapshot.sources.map((source) => ({
            ...source,
            status: 'UNAVAILABLE',
            asOf: null,
          })),
        },
      }).success,
    ).toBe(false);
    expect(
      assistantActionSchema.safeParse({
        version: 1,
        action: 'receivables-follow-up',
        status: 'BLOCKED',
        scope: 'NONE',
        reason: 'RECEIVABLES_SOURCE_PENDING',
        observedAt: snapshot.generatedAt,
      }).success,
    ).toBe(true);
  });
  it('rejects a response for a different action and never sends prompt text', async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() => Promise.resolve(Response.json(daily)));
    vi.stubGlobal('fetch', fetcher);
    try {
      await expect(
        loadAssistantAction('daily-summary', new AbortController().signal),
      ).resolves.toMatchObject({ counts: { visible: 1 } });
      expect(fetcher.mock.calls[0]?.[0]).toBe(
        '/api/assistant/actions/daily-summary',
      );
      expect(fetcher.mock.calls[0]?.[1]).not.toHaveProperty('body');
      await expect(
        loadAssistantAction('sales-analysis', new AbortController().signal),
      ).rejects.toThrow('INVALID_RESPONSE');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

it('validates Phase2 priority and provenance against the source evidence', () => {
  const evidence = {
    ...snapshot,
    followUps: [
      {
        ...snapshot.followUps[0]!,
        dueAt: '2026-10-16T08:00:00.000Z',
        reason: 'DUE_SOON',
        sourcePriority: 'URGENT',
      },
    ],
  };
  const recommendation = {
    followUpId: 'calendar:synthetic',
    id: 'calendar:synthetic:PERSONAL_DUE_V2',
    ruleId: 'PERSONAL_DUE_V2',
    reason: 'THIS_WEEK',
    priority: 'HIGH',
    source: 'calendar',
    observedAt: evidence.sources[0]!.asOf,
  };
  const value = {
    ...daily,
    policyVersion: 2,
    snapshot: evidence,
    counts: { visible: 1, overdue: 0, dueSoon: 1, assigned: 0 },
    recommendations: [recommendation],
  };
  expect(assistantActionSchema.safeParse(value).success).toBe(true);
  for (const change of [
    { priority: 'LOW' },
    { source: 'notes' },
    { observedAt: '2026-10-11T08:00:00.000Z' },
    { reason: 'OVERDUE' },
    { id: 'invented' },
  ]) {
    expect(
      assistantActionSchema.safeParse({
        ...value,
        recommendations: [{ ...recommendation, ...change }],
      }).success,
    ).toBe(false);
  }
  expect(
    assistantActionSchema.safeParse({
      ...value,
      snapshot: {
        ...evidence,
        sources: evidence.sources.map((source) => ({
          ...source,
          status: 'UNAVAILABLE',
          asOf: null,
        })),
      },
    }).success,
  ).toBe(false);
});

const filters = {
  startDate: '2026-10-01',
  endDate: '2026-10-11',
  originId: null,
  destinationId: null,
  branchId: null,
};
it('validates filtered daily summaries without dropping personal evidence checks', () => {
  const value = {
    ...daily,
    version: 2,
    filters,
    corporate: {
      sales: { status: 'UNAVAILABLE' },
      balances: { status: 'DENIED' },
    },
  };
  expect(assistantFilteredActionSchema.safeParse(value).success).toBe(true);
  expect(
    assistantFilteredActionSchema.safeParse({
      ...value,
      counts: { ...daily.counts, visible: 5 },
    }).success,
  ).toBe(false);
  expect(
    assistantFilteredActionSchema.safeParse({
      ...value,
      filters: { ...filters, companyId: 'x' },
    }).success,
  ).toBe(false);
});
it('rejects a filtered response for a different requested period', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      Response.json({
        ...daily,
        version: 2,
        filters,
        corporate: {
          sales: { status: 'UNAVAILABLE' },
          balances: { status: 'DENIED' },
        },
      }),
    ),
  );
  try {
    await expect(
      loadAssistantAction('daily-summary', new AbortController().signal, {
        startDate: '2026-10-02',
        endDate: filters.endDate,
      }),
    ).rejects.toThrow('INVALID_RESPONSE');
  } finally {
    vi.unstubAllGlobals();
  }
});
