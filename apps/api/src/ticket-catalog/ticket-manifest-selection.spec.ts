import { describe, expect, it, vi } from 'vitest';
import type { TicketOfferCreateV1 } from '@nora/contracts';
import {
  TicketPublicService,
  validateTicketOffer,
} from './ticket-public.service';

const templateId = '10000000-0000-4000-8000-000000000003';
const offerId = '10000000-0000-4000-8000-000000000004';
const input = {
  originId: '10000000-0000-4000-8000-000000000001',
  destinationId: '10000000-0000-4000-8000-000000000002',
  departureAt: '2099-09-30T22:00:00Z',
  arrivalAt: '2099-10-01T01:00:00Z',
  carrierName: 'Synthetic',
  serviceNumber: 'TEST',
  cabinClassCode: 'ECONOMY' as const,
  totalCapacity: 20,
  manifestTemplateId: templateId,
};
const actor = {
  userId: 'user',
  branchIds: ['branch'],
  permissions: ['ticket_catalog.manage'],
} as never;

describe('Ticket Catalog manifest selection', () => {
  it('validates null/default and UUID template identifiers', () => {
    expect(
      validateTicketOffer({ ...input, manifestTemplateId: null })
        .manifestTemplateId,
    ).toBeNull();
    expect(() =>
      validateTicketOffer({ ...input, manifestTemplateId: 'invalid' }),
    ).toThrow('معتبر');
  });

  it('persists an explicitly validated choice on publication', async () => {
    const upsert = vi.fn().mockResolvedValue({
      ...input,
      id: offerId,
      branchId: 'branch',
      version: 1,
      departureAt: new Date(input.departureAt),
      arrivalAt: new Date(input.arrivalAt),
    });
    const directory = {
      manifestTemplateById: vi.fn().mockResolvedValue({ id: templateId }),
    };
    const service = new TicketPublicService(
      { client: { ticketPublishedOffer: { upsert } } } as never,
      { ensureOfferPurchaseRequest: vi.fn() } as never,
      directory as never,
    );
    await service.publish(input, actor, 'branch', 'key');
    expect(directory.manifestTemplateById).toHaveBeenCalledWith(
      templateId,
      '2099-10-01',
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ manifestTemplateId: templateId }),
      }),
    );
  });

  it('rejects inactive choices before writing an offer', async () => {
    const upsert = vi.fn();
    const service = new TicketPublicService(
      { client: { ticketPublishedOffer: { upsert } } } as never,
      {} as never,
      {
        manifestTemplateById: vi
          .fn()
          .mockRejectedValue(new Error('قالب فعال نیست')),
      } as never,
    );
    await expect(
      service.publish(input, actor, 'branch', 'key'),
    ).rejects.toThrow('فعال');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('scopes the public selection lookup to the consumer branches', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValue({ manifestTemplateId: templateId });
    const service = new TicketPublicService(
      { client: { ticketPublishedOffer: { findFirst } } } as never,
      {} as never,
    );
    expect(await service.manifestSelection(offerId, ['allowed'])).toBe(
      templateId,
    );
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: offerId, branchId: { in: ['allowed'] } },
      select: { manifestTemplateId: true },
    });
    findFirst.mockResolvedValue(null);
    await expect(service.manifestSelection(offerId, ['other'])).rejects.toThrow(
      'شعبه',
    );
  });

  it.each([null, undefined])(
    'lets template-only revisions preserve sold/held/tour-linked schedules (%s)',
    async (selection) => {
      const row = {
        ...input,
        id: offerId,
        version: 2,
        branchId: 'branch',
        departureAt: new Date(input.departureAt),
        arrivalAt: new Date(input.arrivalAt),
        capacityAllocations: [{ quantity: 1 }],
        capacityHolds: selection === undefined ? [] : [{ quantity: 1 }],
        tourOutboundDepartures: selection === undefined ? [] : [{ id: 'tour' }],
        tourReturnDepartures: [],
        audit: [],
      };
      const tx = {
        $queryRaw: vi.fn(),
        ticketPublishedOffer: {
          findFirst: vi.fn().mockResolvedValue(row),
          update: vi.fn().mockResolvedValue({ version: 3 }),
        },
        ticketOfferAudit: { create: vi.fn() },
      };
      const service = new TicketPublicService(
        { client: { $transaction: vi.fn((fn) => fn(tx)) } } as never,
        {} as never,
      );
      const revised: TicketOfferCreateV1 = { ...input };
      if (selection === undefined) delete revised.manifestTemplateId;
      else revised.manifestTemplateId = selection;
      await service.revise(
        offerId,
        {
          expectedVersion: 2,
          offer: revised,
        },
        actor,
      );
      expect(tx.ticketPublishedOffer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            manifestTemplateId: selection === undefined ? templateId : null,
            departureAt: row.departureAt,
            arrivalAt: row.arrivalAt,
          }),
        }),
      );
    },
  );
});
