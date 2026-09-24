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

import {
  packageGeneratorSectionLabels,
  PackageGeneratorWorkspace,
} from './package-generator-workspace';
import { sourcePackageGeneratorPath } from './source-package-generator';

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
    expect(html).toContain('title="پکیج‌ساز کامل سفر"');
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
      '/package-generator/index.html?v=rubi-template-refresh',
    );
  });

  it('asks for the destination country before listing its package designs', () => {
    const publicRoot = resolve(process.cwd(), 'public/package-generator');
    const html = readFileSync(resolve(publicRoot, 'index.html'), 'utf8');
    const app = readFileSync(resolve(publicRoot, 'app.js'), 'utf8');

    expect(html.indexOf('id="templateCountry"')).toBeLessThan(
      html.indexOf('id="template"'),
    );
    expect(html).toContain('<option value="turkey" selected>ترکیه</option>');
    expect(html).toContain('<option value="thailand">تایلند</option>');
    expect(app).toContain("turkey:['combined','kus','antalya','bodrum','nss']");
    expect(app).toContain(
      "malaysia:['malaysia-kuala','malaysia-penang','malaysia-singapore','malaysia-langkawi']",
    );
    expect(app).toContain(
      "thailand:['thailand-phuket','thailand-bangkok-phuket','thailand-pattaya']",
    );
    expect(app).toContain('syncTemplateCountry(d.template)');
  });

  it('opens the static generator without requesting pricing permissions', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/pricing-management/components/package-generator-workspace.tsx',
      ),
      'utf8',
    );

    expect(source).not.toContain('packagePricingApi.session');
    expect(source).not.toContain('canViewPackageBanner');
    expect(source).not.toContain('PACKAGE_GENERATOR_FORBIDDEN');
    expect(renderToStaticMarkup(<PackageGeneratorWorkspace />)).toContain(
      'src="/package-generator/index.html?v=rubi-template-refresh"',
    );
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
