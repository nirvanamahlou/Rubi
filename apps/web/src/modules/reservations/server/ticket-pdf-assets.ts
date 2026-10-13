import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

type AssetReader = (path: string) => Promise<Buffer>;

export async function readTicketBrandAsset(
  asset: string,
  cwd = process.cwd(),
  reader: AssetReader = readFile,
): Promise<Buffer> {
  const candidates = [
    join(cwd, 'public', 'brand', asset),
    join(cwd, 'apps', 'web', 'public', 'brand', asset),
  ];

  for (const candidate of candidates) {
    const bytes = await reader(candidate).catch(() => null);
    if (bytes?.length && bytes.length <= 5_000_000) return bytes;
  }

  throw new Error('PDF_BRAND_ASSET_UNAVAILABLE');
}
