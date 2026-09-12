import { describe, expect, it, vi } from 'vitest';
import type { OrganizationActivityEvent } from '@rubi/contracts';
import { activityWorkbook, loadActivityReport } from './activity-report';
import { createOrganizationXlsx } from './organization-xlsx';

const event = {
  id: 'B2B:id',
  source: 'B2B',
  category: 'PROFILE',
  action: 'b2b.agency.update',
  outcome: 'SUCCESS',
  entityId: 'org',
  entityType: 'AgencyOperationalProfile',
  actorUserId: 'actor',
  actorName: '=HYPERLINK("unsafe")',
  occurredAt: '2026-01-01T00:00:00.000Z',
  changedFields: ['مدیر حساب'],
} satisfies OrganizationActivityEvent;
describe('Complete activity exports', () => {
  it('loads every page with one snapshot and preserves filters', async () => {
    const read = vi
      .fn()
      .mockResolvedValueOnce({
        data: [event],
        asOf: '2026-01-02',
        nextCursor: 'next',
        unavailableSources: [],
      })
      .mockResolvedValueOnce({
        data: [{ ...event, id: 'B2B:second' }],
        asOf: '2026-01-02',
        nextCursor: null,
        unavailableSources: [],
      });
    const result = await loadActivityReport(read, { category: 'PROFILE' });
    expect(result.data).toHaveLength(2);
    expect(read).toHaveBeenLastCalledWith({
      category: 'PROFILE',
      asOf: '2026-01-02',
      cursor: 'next',
    });
    expect(activityWorkbook(result.data)).toHaveLength(3);
  });
  it('fails the entire export when a later page fails or repeats its cursor', async () => {
    const read = vi.fn().mockResolvedValue({
      data: [event],
      asOf: '2026-01-02',
      nextCursor: 'same',
      unavailableSources: [],
    });
    await expect(loadActivityReport(read, {})).rejects.toThrow('تکرار');
    read
      .mockReset()
      .mockResolvedValueOnce({
        data: [event],
        asOf: '2026-01-02',
        nextCursor: 'next',
      })
      .mockRejectedValueOnce(new Error('expired session'));
    await expect(loadActivityReport(read, {})).rejects.toThrow(
      'expired session',
    );
  });
  it('writes untrusted actor names as inline text rather than spreadsheet formulas', () => {
    const xml = new TextDecoder().decode(
      createOrganizationXlsx(activityWorkbook([event])),
    );
    expect(xml).toContain('inlineStr');
    expect(xml).not.toContain('<f>');
    expect(xml).toContain('HYPERLINK');
  });
});
