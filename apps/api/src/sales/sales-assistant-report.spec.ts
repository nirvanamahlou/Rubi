import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import type { MasterDataService } from '../master-data/master-data.service';
import { SalesAssistantController } from './sales-assistant.controller';
import {
  buildSalesAssistantReport,
  salesAssistantWindows,
} from './sales-assistant-report';
import type { AuthenticatedRequest } from '../iam/iam.types';
const now = new Date('2026-10-12T08:00:00.000Z');
const row = {
  id: 'synthetic',
  createdAt: new Date('2026-10-10T00:00:00Z'),
  updatedAt: now,
  confirmedAt: now,
  status: 'CONFIRMED',
  originId: 'origin',
  destinationId: 'destination',
  _count: { passengers: 2 },
};
describe('Sales-owned assistant weekly projection', () => {
  it('uses public city labels and reports missing labels without changing counts', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const findMany = vi.fn().mockResolvedValue([row]);
      const detail = vi
        .fn()
        .mockRejectedValue(new Error('Synthetic reference failure'));
      const controller = new SalesAssistantController(
        {
          client: { salesContract: { findMany } },
        } as unknown as DatabaseService,
        { detail } as unknown as MasterDataService,
      );
      const request = {
        actor: { permissions: ['sales.contracts.read.all'] },
      } as unknown as AuthenticatedRequest;
      const missing = await controller.weekly(request, {});
      expect(missing.current.contractCount).toBe(1);
      expect(missing.routeNamesComplete).toBe(false);
      expect(missing.current.routes[0]?.originName).toBeNull();
      detail.mockResolvedValue({ data: { name: 'Synthetic city' } } as never);
      const named = await controller.weekly(request, {});
      expect(named.routeNamesComplete).toBe(true);
      expect(named.current.routes[0]?.originName).toBe('Synthetic city');
      expect(detail).toHaveBeenCalledWith('cities', row.originId);
    } finally {
      vi.useRealTimers();
    }
  });
  it('uses Tehran civil midnight and contiguous complete seven-day windows', () => {
    expect(salesAssistantWindows(now)).toEqual({
      current: {
        startUtc: '2026-10-04T20:30:00.000Z',
        endUtc: '2026-10-11T20:30:00.000Z',
      },
      previous: {
        startUtc: '2026-09-27T20:30:00.000Z',
        endUtc: '2026-10-04T20:30:00.000Z',
      },
    });
    expect(
      salesAssistantWindows(new Date('2026-10-11T20:29:59Z')).current.endUtc,
    ).toBe('2026-10-10T20:30:00.000Z');
  });
  it('counts distinct valid contracts by creation date, excludes cancelled/drafts and reports passengers separately', () => {
    const report = buildSalesAssistantReport(
      [
        row,
        row,
        { ...row, id: 'cancelled', status: 'CANCELLED' },
        { ...row, id: 'draft', status: 'DRAFT' },
        { ...row, id: 'unconfirmed', confirmedAt: null },
        { ...row, id: 'previous', createdAt: new Date('2026-10-02T00:00:00Z') },
        { ...row, id: 'today', createdAt: new Date('2026-10-11T20:30:00Z') },
      ],
      now,
    );
    expect(report.current.contractCount).toBe(1);
    expect(report.current.passengerCount).toBe(2);
    expect(report.previous.contractCount).toBe(1);
    expect(report.current.routes[0]).toMatchObject({
      contractCount: 1,
      passengerCount: 2,
    });
    expect(report.unavailable).toContain('NET_SALES_REFUND_SOURCE_PENDING');
    expect(report).not.toHaveProperty('amount');
  });
  it('checks permission and rejects client scope before touching any database', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const controller = new SalesAssistantController({
      client: { salesContract: { findMany } },
    } as unknown as DatabaseService);
    const request = {
      actor: { userId: 'synthetic', permissions: [], branchIds: [] },
    } as unknown as AuthenticatedRequest;
    await expect(controller.weekly(request, {})).rejects.toThrow(
      'SALES_ALL_READ_REQUIRED',
    );
    request.actor.permissions = ['sales.contracts.read.all'];
    await expect(
      controller.weekly(request, { company: 'other' }),
    ).rejects.toThrow('ASSISTANT_FIXED_SCOPE');
    expect(findMany).not.toHaveBeenCalled();
    const result = await controller.weekly(request, {});
    expect(result.current.contractCount).toBe(0);
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      take: 5001,
      select: { _count: { select: { passengers: true } } },
    });
    expect(JSON.stringify(findMany.mock.calls[0]?.[0])).not.toContain(
      'customerName',
    );
    findMany.mockResolvedValue(Array.from({ length: 5001 }, () => row));
    await expect(controller.weekly(request, {})).rejects.toThrow(
      'SALES_SOURCE_CAP_EXCEEDED',
    );
  });
});
