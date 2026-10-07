'use client';
import Image from '@/i18n/image';
import { useDisplayLanguage } from '@/i18n/locale-context';

function EnglishCompanyName({ name }: { name: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center text-blue-950">
      <span className="text-2xl font-black tracking-tight">{name}</span>
      <span className="text-xs font-semibold uppercase tracking-widest text-blue-700">
        Travel agency
      </span>
    </div>
  );
}

export function CompanyLogos({ compact = false }: { compact?: boolean }) {
  const english = useDisplayLanguage() === 'en';
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
              ? 'relative h-28 overflow-hidden rounded-2xl border bg-white shadow-sm'
              : 'relative h-44 overflow-hidden rounded-2xl bg-white shadow-lg shadow-blue-950/20'
          }
        >
          {english ? (
            <EnglishCompanyName name="Niayesh Seir" />
          ) : (
            <Image
              alt="لوگوی شرکت نیایش سیر"
              className={compact ? 'object-contain p-2' : 'object-contain p-3'}
              fill
              priority={!compact}
              sizes={compact ? '45vw' : '220px'}
              src="/brand/niyayesh-seir-full.png"
            />
          )}
        </div>
        <div
          className={
            compact
              ? 'relative h-28 overflow-hidden rounded-2xl border bg-white shadow-sm'
              : 'relative h-44 overflow-hidden rounded-2xl bg-white shadow-lg shadow-blue-950/20'
          }
        >
          {english ? (
            <EnglishCompanyName name="Jahan Bastan" />
          ) : (
            <Image
              alt="لوگوی شرکت جهان باستان"
              className={compact ? 'object-contain p-2' : 'object-contain p-3'}
              fill
              priority={!compact}
              sizes={compact ? '45vw' : '220px'}
              src="/brand/jahan-bastan.png"
            />
          )}
        </div>
      </div>
    </div>
  );
}
