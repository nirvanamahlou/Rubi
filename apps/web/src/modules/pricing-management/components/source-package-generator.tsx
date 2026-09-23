'use client';

import { useState } from 'react';

import { Skeleton } from '@/components/ui/surfaces';

export const sourcePackageGeneratorPath =
  '/package-generator/index.html?v=rubi-visual-polish';

export function SourcePackageGenerator() {
  const [loaded, setLoaded] = useState(false);

  return (
    <section
      aria-label="پکیج‌ساز کامل"
      className="relative min-h-[52rem] overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-[#edf3fa] to-amber-50/70 shadow-xl shadow-primary/10"
    >
      {!loaded ? (
        <div className="absolute inset-0 z-10 grid gap-4 bg-background p-5">
          <Skeleton className="h-16" />
          <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
            <Skeleton className="h-[44rem]" />
            <Skeleton className="h-[44rem]" />
          </div>
        </div>
      ) : null}
      <iframe
        className="block h-[calc(100vh-7rem)] min-h-[52rem] w-full border-0"
        onLoad={() => setLoaded(true)}
        referrerPolicy="no-referrer"
        src={sourcePackageGeneratorPath}
        title="پکیج‌ساز کامل سفر"
      />
    </section>
  );
}
