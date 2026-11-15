import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import {
  attachAirlineLogos,
  websiteAirlineLogo,
  AIRLINE_LOGO_LIMITS,
} from './airline-logos';
import type { DocumentFileDelivery } from '../documents/documents.service';
import type { AuthenticatedActor } from '@nora/contracts';
const actor: AuthenticatedActor = {
  userId: 'service',
  sessionId: '',
  branchIds: ['site-branch'],
  permissions: ['sales.contracts.create'],
};
const record = {
  id: 'airline',
  resource: 'airlines',
  status: 'active',
  name: 'Synthetic Air',
  code: 'SA',
  attributes: { logoFileReference: '00000000-0000-4000-8000-000000000001' },
};
async function image(color = 'blue') {
  return sharp({
    create: { width: 600, height: 200, channels: 3, background: color },
  })
    .jpeg()
    .withExif({ IFD0: { ImageDescription: 'SYNTHETIC_PRIVATE_METADATA' } })
    .toBuffer();
}
function delivery(
  bytes: Buffer,
  mimeType = 'image/jpeg',
): DocumentFileDelivery {
  return {
    stream: Readable.from([bytes]),
    sizeBytes: bytes.length,
    mimeType,
    fileName: 'PRIVATE_SOURCE_NAME.jpg',
  };
}
describe('normalized public airline logo assets', () => {
  it('re-encodes bounded PNG pixels without source metadata and deduplicates repeated carriers', async () => {
    const bytes = await image();
    const load = vi.fn().mockImplementation(async () => delivery(bytes));
    const flights = [
      { carrierName: 'Synthetic Air' },
      { carrierName: 'SYNTHETIC AIR' },
    ];
    const assets = await attachAirlineLogos(flights, load);
    expect(load).toHaveBeenCalledOnce();
    expect(assets).toHaveLength(1);
    const asset = assets[0]!;
    const png = Buffer.from(asset.dataBase64, 'base64');
    const metadata = await sharp(png).metadata();
    expect(asset.sha256).toBe(createHash('sha256').update(png).digest('hex'));
    expect(metadata.format).toBe('png');
    expect(metadata.width).toBeLessThanOrEqual(256);
    expect(metadata.height).toBeLessThanOrEqual(256);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(flights[0]).toMatchObject({
      carrierLogoUrl:
        'https://niyayeshseir.ir/api/v1/erp/airline-logos/' + asset.sha256,
    });
    expect(flights[1]).toMatchObject({
      carrierLogoUrl:
        'https://niyayeshseir.ir/api/v1/erp/airline-logos/' + asset.sha256,
    });
    expect(JSON.stringify(assets)).not.toContain('PRIVATE');
    expect(png.includes(Buffer.from('SYNTHETIC_PRIVATE_METADATA'))).toBe(false);
  });
  it('deduplicates the same normalized pixels across different airline names', async () => {
    const bytes = await image();
    const flights = [{ carrierName: 'A' }, { carrierName: 'B' }];
    expect(
      await attachAirlineLogos(flights, async () => delivery(bytes)),
    ).toHaveLength(1);
  });
  it('omits unapproved/missing images without publishing source URLs or changing the product', async () => {
    const flights = [
      {
        carrierName: 'Private',
        carrierLogoUrl: 'https://private.invalid/file',
      },
    ];
    expect(
      await attachAirlineLogos(flights, async () => {
        throw Error('private storage path');
      }),
    ).toEqual([]);
    expect(flights).toEqual([{ carrierName: 'Private' }]);
  });
  it('rejects SVG, mislabeled content, truncated and oversized streams', async () => {
    const cases = [
      delivery(Buffer.from('<svg/>'), 'image/svg+xml'),
      delivery(Buffer.from('<svg/>'), 'image/png'),
      { ...delivery(await image()), sizeBytes: 1 },
      {
        ...delivery(Buffer.from('x')),
        sizeBytes: AIRLINE_LOGO_LIMITS.inputBytes + 1,
      },
    ];
    for (const input of cases)
      expect(
        await attachAirlineLogos([{ carrierName: 'A' }], async () => input),
      ).toEqual([]);
  });
  it('does not read an image when the bounded snapshot budget is exhausted', async () => {
    const load = vi.fn();
    expect(await attachAirlineLogos([{ carrierName: 'A' }], load, 0)).toEqual(
      [],
    );
    expect(load).not.toHaveBeenCalled();
  });
  it('never exceeds the finite asset count', async () => {
    const flights = Array.from({ length: 33 }, (_, i) => ({
      carrierName: 'Synthetic ' + i,
    }));
    const load = vi.fn().mockImplementation(async (name: string) =>
      delivery(
        await sharp({
          create: {
            width: 8,
            height: 8,
            channels: 3,
            background: 'rgb(' + Number(name.split(' ')[1]) * 7 + ',0,0)',
          },
        })
          .png()
          .toBuffer(),
        'image/png',
      ),
    );
    const assets = await attachAirlineLogos(flights, load);
    expect(assets).toHaveLength(32);
    expect(load).toHaveBeenCalledTimes(32);
    expect(flights[32]).not.toHaveProperty('carrierLogoUrl');
  });
});
describe('native airline attachment lookup', () => {
  it('uses an exact active airline and the existing branch-scoped Documents workflow port', async () => {
    const references = { list: vi.fn().mockResolvedValue({ data: [record] }) };
    const documents = {
      previewWebsiteAirlineLogo: vi.fn().mockResolvedValue(undefined),
    };
    await websiteAirlineLogo(
      'Synthetic Air',
      actor,
      references as never,
      documents as never,
    );
    expect(documents.previewWebsiteAirlineLogo).toHaveBeenCalledWith(
      { documentId: record.attributes.logoFileReference, airlineId: record.id },
      actor,
    );
    expect(actor.permissions).toEqual(['sales.contracts.create']);
  });
  it('does not guess between ambiguous, inactive or unrelated records', async () => {
    const documents = { previewWebsiteAirlineLogo: vi.fn() };
    for (const data of [
      [record, { ...record, id: 'other' }],
      [{ ...record, status: 'inactive' }],
      [{ ...record, name: 'Other', code: 'XX' }],
    ]) {
      await websiteAirlineLogo(
        'Synthetic Air',
        actor,
        { list: vi.fn().mockResolvedValue({ data }) } as never,
        documents as never,
      );
    }
    expect(documents.previewWebsiteAirlineLogo).not.toHaveBeenCalled();
  });
});
