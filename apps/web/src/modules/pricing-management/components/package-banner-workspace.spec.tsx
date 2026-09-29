import type { LoginResponse } from '@nora/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  loadPackageBanner,
  PackageBannerWorkspace,
  safePricingReturnTo,
} from './package-banner-workspace';

const session: LoginResponse = {
  user: {
    id: 'user-1',
    username: 'seller',
    email: null,
    displayName: 'فروشنده',
    permissions: ['package_pricing.read', 'package_pricing.render'],
    branches: [{ id: 'branch-1', code: 'THR', name: 'تهران' }],
  },
};

describe('package banner workspace', () => {
  it('renders a dedicated page with loading and real output availability state', () => {
    const html = renderToStaticMarkup(
      <PackageBannerWorkspace packageId="departure-1" />,
    );
    expect(html).toContain('ساخت بنر پکیج');
    expect(html).toContain('بازگشت به همان پکیج');
    expect(html).not.toContain('با موفقیت ساخته شد');
  });

  it('denies access before package data is fetched', async () => {
    const tours = vi.fn();
    await expect(
      loadPackageBanner(
        'departure-1',
        {},
        {
          session: vi.fn().mockResolvedValue({
            ...session,
            user: { ...session.user, permissions: ['package_pricing.read'] },
          }),
          tours,
          tourCosts: vi.fn(),
          tourPublications: vi.fn(),
          bannerTemplates: vi.fn(),
        },
      ),
    ).rejects.toMatchObject({ status: 403, code: 'PACKAGE_FORBIDDEN' });
    expect(tours).not.toHaveBeenCalled();
  });

  it('uses the selected package, batch and publication through module APIs', async () => {
    const tour = { id: 'departure-1', branchId: 'branch-1' };
    const batch = { id: 'batch-1' };
    const publication = { id: 'publication-1' };
    const result = await loadPackageBanner(
      'departure-1',
      { batchId: 'batch-1', publicationId: 'publication-1' },
      {
        session: vi.fn().mockResolvedValue(session),
        tours: vi.fn().mockResolvedValue({ version: 1, data: [tour] }),
        tourCosts: vi.fn().mockResolvedValue({
          tour,
          purchaseBatches: [batch],
        }),
        tourPublications: vi.fn().mockResolvedValue([publication]),
        bannerTemplates: vi.fn().mockResolvedValue({
          version: 1,
          data: [{ id: 'template-1' }],
        }),
      } as never,
    );
    expect(result.batch).toBe(batch);
    expect(result.publication).toBe(publication);
    expect(result.templates).toEqual([{ id: 'template-1' }]);
  });

  it('only accepts return links to the pricing management page', () => {
    expect(
      safePricingReturnTo(
        '/sales/pricing/management?departure=departure-1&batch=batch-1',
      ),
    ).toBe('/sales/pricing/management?departure=departure-1&batch=batch-1');
    expect(
      safePricingReturnTo(
        '/sales/pricing/generator?package=package-1&departure=departure-1',
      ),
    ).toBe('/sales/pricing/generator?package=package-1&departure=departure-1');
    expect(safePricingReturnTo('https://evil.example/phishing')).toBe(
      '/sales/pricing/management',
    );
    expect(safePricingReturnTo('/finance')).toBe('/sales/pricing/management');
  });
});
