import { describe, expect, it, vi } from 'vitest';
import { CustomerAffairsAssistantController } from './customer-affairs-assistant.controller';
import type { DatabaseService } from '../database/database.service';
import type { SalesAssistantConfirmationService } from '../sales/sales-assistant-confirmation.service';
import type { AuthenticatedRequest } from '../iam/iam.types';
const now = new Date('2026-10-12T08:00:00Z');
describe('Assistant CALL cohort public boundaries', () => {
  it('counts unique logged-call leads, not handoffs or customers; only accepted confirmed contracts after the call convert', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const findMany = vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'lead1',
            updatedAt: now,
            timeline: [{ occurredAt: new Date('2026-10-08T08:00:00Z') }],
            handoffs: [
              { salesContractId: 'confirmed1', updatedAt: now },
              { salesContractId: 'confirmed2', updatedAt: now },
            ],
          },
          {
            id: 'lead2',
            updatedAt: now,
            timeline: [{ occurredAt: new Date('2026-10-08T08:00:00Z') }],
            handoffs: [{ salesContractId: 'before-call', updatedAt: now }],
          },
          {
            id: 'lead3',
            updatedAt: now,
            timeline: [{ occurredAt: new Date('2026-10-08T08:00:00Z') }],
            handoffs: [{ salesContractId: 'cancelled', updatedAt: now }],
          },
        ])
        .mockResolvedValueOnce([]);
      const assistantConfirmedContracts = vi.fn().mockResolvedValue([
        { id: 'confirmed1', confirmedAt: now, updatedAt: now },
        { id: 'confirmed2', confirmedAt: now, updatedAt: now },
        {
          id: 'before-call',
          confirmedAt: new Date('2026-10-01T00:00:00Z'),
          updatedAt: now,
        },
      ]);
      const controller = new CustomerAffairsAssistantController(
        {
          client: { customerAffairsLead: { findMany } },
        } as unknown as DatabaseService,
        {
          assistantConfirmedContracts,
        } as unknown as SalesAssistantConfirmationService,
      );
      const request = {
        actor: {
          permissions: [
            'customer_affairs.lead.read',
            'sales.contracts.read.all',
          ],
          branchIds: ['authorized-only'],
        },
      } as unknown as AuthenticatedRequest;
      const report = await controller.conversion(request, {});
      expect(report.current).toMatchObject({
        contactedLeads: 3,
        convertedLeads: 1,
        conversionBasisPoints: 3333,
      });
      expect(report.previous).toMatchObject({
        contactedLeads: 0,
        conversionBasisPoints: null,
      });
      expect(report.scope).toBe('AUTHORIZED_BRANCHES');
      expect(findMany.mock.calls[0]?.[0]).toMatchObject({
        where: {
          branchId: { in: ['authorized-only'] },
          timeline: { some: { type: 'CALL' } },
        },
        select: { handoffs: { where: { status: 'ACCEPTED' } } },
      });
      expect(JSON.stringify(report)).not.toMatch(
        /lead1|confirmed1|phone|summary/,
      );
      request.actor.permissions = [];
      await expect(controller.conversion(request, {})).rejects.toThrow(
        'ASSISTANT_COHORT_READ_REQUIRED',
      );
      await expect(
        controller.conversion(request, { branchId: 'foreign' }),
      ).rejects.toThrow('ASSISTANT_FIXED_SCOPE');
      expect(findMany).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
