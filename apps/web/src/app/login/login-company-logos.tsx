'use client';
import Image from '@/i18n/image';

export function CompanyLogos({ compact = false }: { compact?: boolean }) {
  return (
    <div>
      <p
        className={
          compact
            ? 'mb-2 text-center text-xs font-bold text-muted-foreground'
            : 'mb-3 text-center text-xs font-bold text-blue-100'
        }
      >
        شرکت‌های فعال در سامانه
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div
          className={
            compact
              ? 'relative aspect-square w-full overflow-hidden rounded-2xl border bg-white shadow-sm'
              : 'relative aspect-square w-full overflow-hidden rounded-2xl bg-white shadow-lg shadow-blue-950/20'
          }
        >
          <Image
            alt="لوگوی شرکت نیایش سیر"
            className="scale-110 object-contain"
            fill
            priority={!compact}
            sizes={compact ? '45vw' : '220px'}
            src="/brand/niyayesh-seir-full.png"
          />
        </div>
        <div
          className={
            compact
              ? 'relative aspect-square w-full overflow-hidden rounded-2xl border bg-white shadow-sm'
              : 'relative aspect-square w-full overflow-hidden rounded-2xl bg-white shadow-lg shadow-blue-950/20'
          }
        >
          <Image
            alt="لوگوی شرکت جهان باستان"
            className="scale-110 object-contain"
            fill
            priority={!compact}
            sizes={compact ? '45vw' : '220px'}
            src="/brand/jahan-bastan-transparent.png"
          />
        </div>
      </div>
    </div>
  );
}
