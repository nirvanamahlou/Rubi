import type { LoginResponse, TourDepartureV1 } from '@nora/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { PackagePricingApiError } from '../api/client';
import {
  loadPackageGeneratorTours,
  packageGeneratorSectionLabels,
  PackageGeneratorWorkspace,
} from './package-generator-workspace';

function session(
  permissions: LoginResponse['user']['permissions'],
): LoginResponse {
  return {
    user: {
      id: 'user-1',
      username: 'seller',
      email: null,
      displayName: 'فروشنده',
      permissions,
      branches: [{ id: 'branch-1', code: 'THR', name: 'تهران' }],
    },
  };
}

describe('package generator workspace', () => {
  it('renders the themed generator shell and loading state', () => {
    const html = renderToStaticMarkup(<PackageGeneratorWorkspace />);

    expect(html).toContain('پک جنریتور');
    expect(html).toContain('Package Generator');
    expect(html).toContain('بازگشت به بخش‌ها');
    expect(html).toContain('animate-pulse');
  });

  it('defines package, banner and sticker as separate generator sections', () => {
    expect(Object.values(packageGeneratorSectionLabels)).toEqual([
      'پکیج جدولی / ترکیبی',
      'بنر تصویری',
      'تولید استیکر',
    ]);
  });

  it('denies loading tours unless both pricing permissions exist', async () => {
    const api = {
      session: vi.fn().mockResolvedValue(session(['package_pricing.read'])),
      tours: vi.fn(),
    };

    await expect(loadPackageGeneratorTours(api)).rejects.toEqual(
      expect.objectContaining<Partial<PackagePricingApiError>>({
        status: 403,
        code: 'PACKAGE_GENERATOR_FORBIDDEN',
      }),
    );
    expect(api.tours).not.toHaveBeenCalled();
  });

  it('loads visible departures after the deny-by-default permission check', async () => {
    const tours = [
      { id: 'departure-1' },
    ] as unknown as readonly TourDepartureV1[];
    const activeSession = session([
      'package_pricing.read',
      'package_pricing.render',
    ]);
    const api = {
      session: vi.fn().mockResolvedValue(activeSession),
      tours: vi.fn().mockResolvedValue({ version: 1, data: tours }),
    };

    await expect(loadPackageGeneratorTours(api)).resolves.toEqual({
      session: activeSession,
      tours,
    });
  });
});
