import { describe, it, expect, vi } from 'vitest';
import type { DatabaseClient } from '@nora/database';
import { readTicketSlaReporting } from '../customer-affairs/ticket-reporting.public';
import { readDueWorkbenchReporting } from '../workbench/workbench-reporting.public';
import { readHrExpiryReporting } from '../hr/hr-expiry-reporting.public';
const at = new Date('2020-01-01T00:00:00Z');
const query = { filters: {} };
const actor = {
  userId: 'me',
  branchIds: ['branch'],
  permissions: ['customer_affairs.ticket.read', 'hr.read'],
};
const db = (v: unknown) => v as DatabaseClient;
describe('new owning report projections', () => {
  it('keeps SLA branch scope, omits no-SLA records and respects paused resolution', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'one',
        branchId: 'branch',
        executionUnit: 'sales',
        status: 'OPEN',
        createdAt: at,
        updatedAt: at,
        firstResponseDueAt: at,
        resolutionDueAt: at,
        firstRespondedAt: null,
        resolvedAt: null,
        closedAt: null,
        pausedAt: null,
        firstResponseBreachedAt: null,
        resolutionBreachedAt: null,
      },
      {
        id: 'paused',
        branchId: 'branch',
        executionUnit: 'sales',
        status: 'OPEN',
        createdAt: at,
        updatedAt: at,
        firstResponseDueAt: at,
        resolutionDueAt: at,
        pausedAt: at,
      },
    ]);
    const result = await readTicketSlaReporting(
      db({ customerAffairsTicket: { findMany } }),
      actor,
      query,
    );
    expect(findMany.mock.calls[0]?.[0].where).toMatchObject({
      branchId: { in: ['branch'] },
      slaPolicyVersion: { not: 'CALL_CENTER_NO_SLA' },
    });
    expect(result.rows[0]?.values).toMatchObject({
      recordCount: 2,
      responseBreaches: 1,
      resolutionBreaches: 1,
    });
    await expect(
      readTicketSlaReporting(
        db({}),
        { ...actor, permissions: ['reporting.read'] },
        query,
      ),
    ).rejects.toThrow();
  });
  it('never includes another users calendar in the overdue report', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'event',
        title: 'پیگیری',
        priority: 'NORMAL',
        dueAt: at,
        updatedAt: at,
      },
    ]);
    const r = await readDueWorkbenchReporting(
      db({ workbenchCalendarEvent: { findMany } }),
      actor,
      query,
    );
    expect(findMany.mock.calls[0]?.[0].where).toMatchObject({
      userId: 'me',
      branchId: { in: ['branch'] },
      status: 'PLANNED',
    });
    expect(r.rows[0]?.values.overdueDays).toBeGreaterThan(0);
  });
  it('uses explicit HR expiry only and requires organization HR access', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const r = await readHrExpiryReporting(
      db({ hrRecord: { findMany } }),
      actor,
      query,
    );
    expect(findMany.mock.calls[0]?.[0].where).toMatchObject({
      deletedAt: null,
      branchId: { in: ['branch'] },
      expiresAt: { not: null },
    });
    expect(r.rows).toEqual([]);
    expect(r.warnings.join(' ')).toContain('تاریخ انقضای صریح');
    await expect(
      readHrExpiryReporting(
        db({}),
        { ...actor, permissions: ['hr.self.read'] },
        query,
      ),
    ).rejects.toThrow();
  });
});
