import { describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { readTicketBrandAsset } from './ticket-pdf-assets';

describe('ticket PDF brand assets', () => {
  it('reads an asset when the process runs from the Web package', async () => {
    const cwd = join('workspace', 'apps', 'web');
    const expected = join(cwd, 'public', 'brand', 'logo.png');
    const reader = vi.fn(async (path: string) => {
      if (path === expected) return Buffer.from('brand');
      throw new Error('missing');
    });

    await expect(
      readTicketBrandAsset('logo.png', cwd, reader),
    ).resolves.toEqual(Buffer.from('brand'));
    expect(reader).toHaveBeenCalledOnce();
  });

  it('falls back to apps/web when the process runs from the repository root', async () => {
    const cwd = 'workspace';
    const expected = join(cwd, 'apps', 'web', 'public', 'brand', 'logo.png');
    const reader = vi.fn(async (path: string) => {
      if (path === expected) return Buffer.from('brand');
      throw new Error('missing');
    });

    await expect(
      readTicketBrandAsset('logo.png', cwd, reader),
    ).resolves.toEqual(Buffer.from('brand'));
    expect(reader).toHaveBeenCalledTimes(2);
  });

  it('uses a stable error code when no safe asset can be read', async () => {
    const reader = vi.fn(async () => {
      throw new Error('missing');
    });

    await expect(
      readTicketBrandAsset('logo.png', 'workspace', reader),
    ).rejects.toThrow('PDF_BRAND_ASSET_UNAVAILABLE');
  });
});
