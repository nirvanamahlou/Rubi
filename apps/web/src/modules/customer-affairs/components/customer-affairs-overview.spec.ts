import type { CustomerAffairsLeadView } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';

import { loadCustomerAffairsOverview } from './customer-affairs-overview';

const recent = { id: 'new-request', stage: 'NEW' } as CustomerAffairsLeadView;
const handoff = {
  id: 'sales-request',
  stage: 'HANDOFF_PROPOSED',
} as CustomerAffairsLeadView;

describe('Customer Affairs overview request panels', () => {
  it('loads new requests separately from waiting Sales and overdue requests', async () => {
    const leads = vi
      .fn()
      .mockImplementation(
        async (
          _search: string,
          options: { stage?: string; overdueOnly?: boolean },
        ) => ({
          data: options.stage ? [handoff] : options.overdueOnly ? [] : [recent],
        }),
      );
    const tickets = vi.fn().mockResolvedValue({ data: [] });
    const result = await loadCustomerAffairsOverview(
      { leadsRead: true, ticketsRead: true },
      { leads, tickets } as unknown as Parameters<
        typeof loadCustomerAffairsOverview
      >[1],
    );

    expect(result.recent).toEqual([recent]);
    expect(result.handoffs).toEqual([handoff]);
    expect(result.overdue).toEqual([]);
    expect(leads).toHaveBeenCalledWith('', { pageSize: 5 });
    expect(leads).toHaveBeenCalledWith('', {
      stage: 'HANDOFF_PROPOSED',
      pageSize: 5,
    });
    expect(leads).toHaveBeenCalledWith('', { overdueOnly: true, pageSize: 5 });
    expect(tickets).toHaveBeenCalledWith('', 'ALL', { pageSize: 5 });
  });

  it('keeps restricted and empty panels empty without querying forbidden records', async () => {
    const leads = vi.fn().mockResolvedValue({ data: [] });
    const tickets = vi.fn().mockResolvedValue({ data: [] });
    const client = { leads, tickets } as unknown as Parameters<
      typeof loadCustomerAffairsOverview
    >[1];
    expect(
      await loadCustomerAffairsOverview(
        { leadsRead: false, ticketsRead: false },
        client,
      ),
    ).toEqual({ handoffs: [], recent: [], tickets: [], overdue: [] });
    expect(leads).not.toHaveBeenCalled();
    expect(tickets).not.toHaveBeenCalled();

    expect(
      await loadCustomerAffairsOverview(
        { leadsRead: true, ticketsRead: false },
        client,
      ),
    ).toEqual({ handoffs: [], recent: [], tickets: [], overdue: [] });
    expect(leads).toHaveBeenCalledTimes(3);
    expect(tickets).not.toHaveBeenCalled();
  });
});
