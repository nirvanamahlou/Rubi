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

/** The existing bundled Latin font is embedded so server-installed fonts cannot reshape digits. */
export async function readTicketLatinFont(
  cwd = process.cwd(),
  reader: AssetReader = readFile,
): Promise<Buffer> {
  for (const candidate of [
    join(cwd, 'public', 'fonts', 'vazirmatn-latin-wght-normal.woff2'),
    join(
      cwd,
      'apps',
      'web',
      'public',
      'fonts',
      'vazirmatn-latin-wght-normal.woff2',
    ),
  ]) {
    const bytes = await reader(candidate).catch(() => null);
    if (bytes?.length && bytes.length <= 5_000_000) return bytes;
  }
  throw new Error('PDF_LATIN_FONT_UNAVAILABLE');
}
