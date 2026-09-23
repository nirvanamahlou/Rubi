import type { LoginResponse } from '@nora/contracts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { usePageBreadcrumbsMock } = vi.hoisted(() => ({
  usePageBreadcrumbsMock: vi.fn(),
}));

vi.mock('@/components/layout/page-breadcrumbs', () => ({
  usePageBreadcrumbs: usePageBreadcrumbsMock,
}));

import type { PackagePricingApiError } from '../api/client';
import {
  loadPackageGeneratorAccess,
  packageGeneratorSectionLabels,
  PackageGeneratorWorkspace,
} from './package-generator-workspace';
import { sourcePackageGeneratorPath } from './source-package-generator';

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
  beforeEach(() => {
    usePageBreadcrumbsMock.mockReset();
  });

  it('keeps the generator title only in its breadcrumb', () => {
    const html = renderToStaticMarkup(<PackageGeneratorWorkspace />);

    expect(html).not.toContain('پک جنریتور');
    expect(html).not.toContain('مدیریت قیمت و پکیج‌ها');
    expect(html).not.toContain('پنل طراحی پکیج');
    expect(html).not.toContain('نسخه کامل فایل مرجع');
    expect(html).not.toContain('بازگشت به بخش‌ها');
    expect(html).toContain('animate-pulse');
    expect(usePageBreadcrumbsMock).toHaveBeenCalledWith(
      '/sales/pricing/generator',
      expect.arrayContaining([
        expect.objectContaining({ title: 'پک جنریتور' }),
      ]),
    );
  });

  it('defines package, banner and sticker as separate generator sections', () => {
    expect(Object.values(packageGeneratorSectionLabels)).toEqual([
      'پکیج جدولی / ترکیبی',
      'بنر تصویری',
      'تولید استیکر',
    ]);
  });

  it('mounts the complete source package generator in the package section', () => {
    expect(sourcePackageGeneratorPath).toBe(
      '/package-generator/index.html?v=rubi-visual-polish',
    );
  });

  it('denies loading tours unless both pricing permissions exist', async () => {
    const api = {
      session: vi.fn().mockResolvedValue(session(['package_pricing.read'])),
    };

    await expect(loadPackageGeneratorAccess(api)).rejects.toEqual(
      expect.objectContaining<Partial<PackagePricingApiError>>({
        status: 403,
        code: 'PACKAGE_GENERATOR_FORBIDDEN',
      }),
    );
  });

  it('opens the generator after the deny-by-default permission check', async () => {
    const activeSession = session([
      'package_pricing.read',
      'package_pricing.render',
    ]);
    const api = {
      session: vi.fn().mockResolvedValue(activeSession),
      tours: vi.fn(),
    };

    await expect(loadPackageGeneratorAccess(api)).resolves.toEqual({
      session: activeSession,
    });
    expect(api.tours).not.toHaveBeenCalled();
  });

  it('defers the heavy banner and sticker bundles until their tabs are selected', () => {
    const publicRoot = resolve(process.cwd(), 'public/package-generator');
    const html = readFileSync(resolve(publicRoot, 'index.html'), 'utf8');
    const loader = readFileSync(resolve(publicRoot, 'mode-loader.js'), 'utf8');

    expect(html).toContain('<script defer src="mode-loader.js"></script>');
    expect(html).not.toContain('<script defer src="installment-assets.js">');
    expect(html).not.toContain('<script defer src="sticker-assets.js">');
    expect(loader).toContain("'installment-assets.js'");
    expect(loader).toContain("'sticker-assets.js'");
  });
});
