import { afterEach, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import type { AuthenticatedActor } from '@nora/contracts';
import { SiteCommerceService } from './site-commerce.service';
import { SalesDocumentBrandingController } from '../sales/sales-document-branding.controller';
const saved = process.env.SITE_COMMERCE_BINDINGS;
afterEach(() => {
  if (saved === undefined) delete process.env.SITE_COMMERCE_BINDINGS;
  else process.env.SITE_COMMERCE_BINDINGS = saved;
});
async function setup() {
  process.env.SITE_COMMERCE_BINDINGS = JSON.stringify({
    nss: { userId: 'website', branchId: 'site' },
  });
  const actor: AuthenticatedActor = {
    userId: 'website',
    branchIds: ['site'],
    permissions: ['sales.contracts.create'],
    sessionId: '',
  };
  const png = await sharp({
    create: { width: 4, height: 4, channels: 3, background: 'blue' },
  })
    .png()
    .toBuffer();
  const findFirst = vi.fn().mockResolvedValue({ id: 'linked' });
  const contract = {
    status: 'CONFIRMED',
    servicesDetail: [],
    ticketSelections: [
      {
        carrierNameSnapshot: 'Synthetic Air',
        direction: 'OUTBOUND',
        departureAt: '2030-01-01',
      },
    ],
  };
  const detail = vi.fn().mockResolvedValue({ data: contract });
  const preview = vi.fn().mockImplementation(async () => ({
    stream: Readable.from([png]),
    mimeType: 'image/png',
    sizeBytes: png.length,
    fileName: 'PRIVATE',
  }));
  const references = {
    list: vi.fn().mockResolvedValue({
      data: [
        {
          id: 'airline',
          resource: 'airlines',
          status: 'active',
          name: 'Synthetic Air',
          code: 'SA',
          attributes: {
            logoFileReference: '00000000-0000-4000-8000-000000000001',
          },
        },
      ],
    }),
  };
  const service = new SiteCommerceService(
    { client: { websiteOrder: { findFirst } } } as never,
    {} as never,
    {} as never,
    {} as never,
    { detail } as never,
    {} as never,
    references as never,
    {} as never,
    {} as never,
    {} as never,
    { previewWebsiteAirlineLogo: preview } as never,
  );
  return { service, actor, findFirst, contract, detail, preview, references };
}
it('returns sanitized PNG only for an exact flight on the bound website contract', async () => {
  const x = await setup();
  const bytes = await x.service.ticketAirlineLogo(
    'contract',
    'Synthetic Air',
    x.actor,
  );
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(x.findFirst).toHaveBeenCalledWith({
    where: { siteCode: 'nss', branchId: 'site', contractId: 'contract' },
    select: { id: true },
  });
  expect(x.preview).toHaveBeenCalledWith(
    {
      documentId: '00000000-0000-4000-8000-000000000001',
      airlineId: 'airline',
    },
    x.actor,
  );
});
it('denies ordinary users, unlinked contracts, cancelled contracts and unrelated carriers before reading an asset', async () => {
  for (const kind of ['actor', 'link', 'cancelled', 'carrier']) {
    const x = await setup();
    if (kind === 'link') x.findFirst.mockResolvedValue(null);
    if (kind === 'cancelled') x.contract.status = 'CANCELLED';
    await expect(
      x.service.ticketAirlineLogo(
        'contract',
        kind === 'carrier' ? 'Other Air' : 'Synthetic Air',
        kind === 'actor' ? { ...x.actor, userId: 'other' } : x.actor,
      ),
    ).rejects.toThrow();
    expect(x.preview).not.toHaveBeenCalled();
  }
});
it('uses only existing read gates and never calls the sanitized port before finance release or after cancellation', async () => {
  for (const kind of ['ok', 'locked', 'contract', 'intake', 'scope']) {
    const airline = vi.fn().mockResolvedValue(Buffer.from('sanitized'));
    const detail = vi.fn().mockResolvedValue({
      data: {
        status: kind === 'contract' ? 'CANCELLED' : 'CONFIRMED',
        branchId: 'site',
      },
    });
    if (kind === 'scope') detail.mockRejectedValue(new Error('denied'));
    const controller = new SalesDocumentBrandingController(
      { detail } as never,
      {
        forContract: vi.fn().mockResolvedValue({
          workflow: {
            supplierStatus: kind === 'intake' ? 'CANCELLED' : 'CONFIRMED',
          },
        }),
      } as never,
      {
        readCustomerContract: vi
          .fn()
          .mockResolvedValue({ approved: kind !== 'locked' }),
      } as never,
      {} as never,
      { ticketAirlineLogo: airline } as never,
    );
    const req = { actor: { userId: 'website' } } as never;
    if (kind === 'ok') {
      const result = await controller.airlineLogo(
        'contract',
        'Synthetic Air',
        req,
      );
      expect(result.getHeaders().type).toBe('image/png');
      expect(airline).toHaveBeenCalledOnce();
    } else {
      await expect(
        controller.airlineLogo('contract', 'Synthetic Air', req),
      ).rejects.toThrow();
      expect(airline).not.toHaveBeenCalled();
    }
  }
});
