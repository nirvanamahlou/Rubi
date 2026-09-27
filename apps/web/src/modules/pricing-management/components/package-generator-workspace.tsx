'use client';

import { PackagePricingBreadcrumbs } from './package-pricing-breadcrumbs';
import { SourcePackageGenerator } from './source-package-generator';

type GeneratorSection = 'package' | 'banner' | 'sticker';

export const packageGeneratorSectionLabels: Record<GeneratorSection, string> = {
  package: 'پکیج جدولی / ترکیبی',
  banner: 'بنر تصویری',
  sticker: 'تولید استیکر',
};

export function PackageGeneratorWorkspace() {
  return (
    <main className="mx-auto grid w-full max-w-7xl gap-5">
      <PackagePricingBreadcrumbs
        currentTitle="پک جنریتور"
        pathname="/sales/pricing/generator"
      />
      <SourcePackageGenerator />
    </main>
  );
}
