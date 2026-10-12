import { describe, expect, it, vi } from 'vitest';
import { assistantActionSchema, loadAssistantAction } from './model';

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
