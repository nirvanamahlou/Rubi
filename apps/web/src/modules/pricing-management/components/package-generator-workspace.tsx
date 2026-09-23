'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { ErrorState, PageHeader, Skeleton } from '@/components/ui/surfaces';
import { packagePricingApi, PackagePricingApiError } from '../api/client';
import { canViewPackageBanner } from '../model/package-banner';
import { PackagePricingBreadcrumbs } from './package-pricing-breadcrumbs';
import { SourcePackageGenerator } from './source-package-generator';

type GeneratorSection = 'package' | 'banner' | 'sticker';

export const packageGeneratorSectionLabels: Record<GeneratorSection, string> = {
  package: 'پکیج جدولی / ترکیبی',
  banner: 'بنر تصویری',
  sticker: 'تولید استیکر',
};

type GeneratorApi = Pick<typeof packagePricingApi, 'session'>;

export async function loadPackageGeneratorAccess(
  api: GeneratorApi = packagePricingApi,
) {
  const session = await api.session();
  if (!canViewPackageBanner(session))
    throw new PackagePricingApiError(
      'برای ورود به پک جنریتور، هر دو مجوز مشاهده قیمت و ساخت بنر لازم است.',
      403,
      'PACKAGE_GENERATOR_FORBIDDEN',
    );
  return { session };
}

export function PackageGeneratorWorkspace() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadPackageGeneratorAccess();
    } catch (cause) {
      setError(cause);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => void load(), 0);
    return () => globalThis.clearTimeout(timer);
  }, [load]);

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-5">
      <PackagePricingBreadcrumbs
        currentTitle="پک جنریتور"
        pathname="/sales/pricing/generator"
      />
      <PageHeader
        actions={
          <Link
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
            href="/sales/pricing"
          >
            <ArrowRight className="size-4" /> بازگشت به بخش‌ها
          </Link>
        }
        title="پک جنریتور"
      />

      {loading ? <Skeleton className="h-[52rem]" /> : null}

      {!loading && error ? (
        <ErrorState
          action={
            <button
              className={buttonVariants({ variant: 'primary' })}
              onClick={() => void load()}
              type="button"
            >
              تلاش دوباره
            </button>
          }
          description={
            error instanceof Error
              ? error.message
              : 'خطای پیش‌بینی‌نشده در دریافت پکیج‌ها رخ داد.'
          }
          title={
            error instanceof PackagePricingApiError && error.status === 403
              ? 'دسترسی به پک جنریتور مجاز نیست'
              : 'پک جنریتور در دسترس نیست'
          }
        />
      ) : null}

      {!loading && !error ? <SourcePackageGenerator /> : null}
    </main>
  );
}
