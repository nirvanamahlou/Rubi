import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { AuthenticatedActor } from '@nora/contracts';
import type {
  DocumentsService,
  DocumentFileDelivery,
} from '../documents/documents.service';
import type { MasterDataService } from '../master-data/master-data.service';

export const AIRLINE_LOGO_LIMITS = {
  count: 32,
  imageBytes: 256 * 1024,
  totalBytes: 768 * 1024,
  inputBytes: 5 * 1024 * 1024,
};
export type AirlineLogoAsset = {
  sha256: string;
  mimeType: 'image/png';
  dataBase64: string;
};
type FlightLogo = { carrierName: string; carrierLogoUrl?: string };
export const carrierKey = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replaceAll('ي', 'ی')
    .replaceAll('ك', 'ک')
    .replace(/[^\p{L}\p{N}]/gu, '');

/** Consume only an exact active airline's branch-authorized BRAND attachment. */
export async function websiteAirlineLogo(
  name: string,
  actor: AuthenticatedActor,
  references: Pick<MasterDataService, 'list'>,
  documents: Pick<DocumentsService, 'previewWebsiteAirlineLogo'>,
): Promise<DocumentFileDelivery | undefined> {
  const response = await references.list('airlines', {
    search: name,
    status: 'active',
    sortBy: 'name',
    sortDirection: 'asc',
    page: 1,
    pageSize: 100,
  });
  const matches = response.data.filter(
    (row) =>
      row.resource === 'airlines' &&
      row.status === 'active' &&
      [
        row.name,
        row.code,
        row.attributes.englishName,
        row.attributes.icaoCode,
      ].some(
        (value) =>
          typeof value === 'string' && carrierKey(value) === carrierKey(name),
      ),
  );
  if (matches.length !== 1) return;
  const row = matches[0]!;
  const documentId = row.attributes.logoFileReference;
  if (
    typeof documentId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      documentId,
    )
  )
    return;
  return documents.previewWebsiteAirlineLogo(
    { documentId, airlineId: row.id },
    actor,
  );
}

/** Public projection contains normalized pixels only, never a private URL or file metadata. */
export async function attachAirlineLogos(
  flights: FlightLogo[],
  load: (name: string) => Promise<DocumentFileDelivery | undefined>,
  totalByteLimit = AIRLINE_LOGO_LIMITS.totalBytes,
  origin = 'https://niyayeshseir.ir',
): Promise<AirlineLogoAsset[]> {
  const assets = new Map<string, AirlineLogoAsset>();
  const urls = new Map<string, string | null>();
  let bytes = 0;
  const budget = Math.max(
    0,
    Math.min(AIRLINE_LOGO_LIMITS.totalBytes, totalByteLimit),
  );
  for (const flight of flights) {
    delete flight.carrierLogoUrl;
    const key = carrierKey(flight.carrierName);
    if (!key) continue;
    if (urls.has(key)) {
      const url = urls.get(key);
      if (url) flight.carrierLogoUrl = url;
      continue;
    }
    urls.set(key, null);
    if (assets.size >= AIRLINE_LOGO_LIMITS.count || bytes >= budget) continue;
    let delivery: DocumentFileDelivery | undefined;
    try {
      delivery = await load(flight.carrierName);
      if (
        !delivery ||
        !['image/png', 'image/jpeg', 'image/webp'].includes(
          delivery.mimeType,
        ) ||
        !Number.isSafeInteger(delivery.sizeBytes) ||
        delivery.sizeBytes < 1 ||
        delivery.sizeBytes > AIRLINE_LOGO_LIMITS.inputBytes
      )
        continue;
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of delivery.stream) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > AIRLINE_LOGO_LIMITS.inputBytes)
          throw Error('Image limit exceeded');
        chunks.push(buffer);
      }
      if (size !== delivery.sizeBytes) continue;
      const input = Buffer.concat(chunks);
      const validMagic =
        delivery.mimeType === 'image/png'
          ? input
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : delivery.mimeType === 'image/jpeg'
            ? input.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
            : input.subarray(0, 4).toString('ascii') === 'RIFF' &&
              input.subarray(8, 12).toString('ascii') === 'WEBP';
      if (!validMagic) continue;
      const image = sharp(input, {
        limitInputPixels: 20_000_000,
        animated: false,
        failOn: 'warning',
      });
      const metadata = await image.metadata();
      if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? '')) continue;
      const png = await image
        .rotate()
        .resize({
          width: 256,
          height: 256,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png({ compressionLevel: 9 })
        .toBuffer();
      if (!png.length || png.length > AIRLINE_LOGO_LIMITS.imageBytes) continue;
      const sha256 = createHash('sha256').update(png).digest('hex');
      if (!assets.has(sha256)) {
        if (bytes + png.length > budget) continue;
        assets.set(sha256, {
          sha256,
          mimeType: 'image/png',
          dataBase64: png.toString('base64'),
        });
        bytes += png.length;
      }
      const url = origin + '/api/v1/erp/airline-logos/' + sha256;
      flight.carrierLogoUrl = url;
      urls.set(key, url);
    } catch {
      // A missing, unapproved or invalid optional brand image never exposes its source.
    } finally {
      delivery?.stream.destroy();
    }
  }
  return [...assets.values()];
}
