import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ReservationsPublicService } from './reservations-public.service';
describe('historical reservation operation fallback', () => {
  it('compares actual server commit times across independent revision streams', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      workflowRevisions: [
        {
          actorUserId: 'workflow',
          createdAt: new Date('2026-09-29T07:00:00Z'),
        },
      ],
      arrangements: [
        {
          updatedByUserId: 'rooms',
          updatedAt: new Date('2026-09-29T08:00:00Z'),
        },
      ],
      hotelPurchases: [
        { actorUserId: 'hotel', createdAt: new Date('2026-09-29T06:00:00Z') },
      ],
      servicePurchases: [
        {
          actorUserId: 'service',
          createdAt: new Date('2026-09-29T09:00:00Z'),
        },
      ],
    });
    const service = new ReservationsPublicService({
      client: { reservationIntake: { findFirst } },
    } as never);
    expect(await service.lastRecordedOperation('intake', ['allowed'])).toEqual({
      actorUserId: 'service',
      occurredAt: new Date('2026-09-29T09:00:00Z'),
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'intake', branchId: { in: ['allowed'] } },
      }),
    );
  });
  it('does not infer an operator from sales intake creation when no mutation exists', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      workflowRevisions: [],
      arrangements: [],
      hotelPurchases: [],
      servicePurchases: [],
    });
    const service = new ReservationsPublicService({
      client: { reservationIntake: { findFirst } },
    } as never);
    expect(
      await service.lastRecordedOperation('intake', ['allowed']),
    ).toBeNull();
    findFirst.mockResolvedValue(null);
    await expect(
      service.lastRecordedOperation('intake', ['other']),
    ).rejects.toThrow(NotFoundException);
  });
});
