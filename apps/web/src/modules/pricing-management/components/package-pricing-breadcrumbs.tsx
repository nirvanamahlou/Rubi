'use client';

import { useMemo } from 'react';

import { usePageBreadcrumbs } from '@/components/layout/page-breadcrumbs';

export function PackagePricingBreadcrumbs({
  currentTitle,
  pathname,
}: {
  currentTitle: string;
  pathname: string;
}) {
  const items = useMemo(
    () => [
      {
        key: 'package-pricing',
        href: '/sales/pricing',
        title: 'مدیریت قیمت و پکیج‌ها',
      },
      { key: pathname, title: currentTitle },
    ],
    [currentTitle, pathname],
  );
  usePageBreadcrumbs(pathname, items);
  return null;
}
