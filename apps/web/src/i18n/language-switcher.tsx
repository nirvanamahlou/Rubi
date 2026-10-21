'use client';
import { useRouter } from 'next/navigation';
import { useSystemPreferences } from '@/components/system-preferences-provider';
import type { DisplayLanguage } from './language';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({
  tone = 'default',
}: {
  tone?: 'default' | 'inverse';
}) {
  const { language, setLanguage } = useSystemPreferences();
  const router = useRouter();
  function choose(next: DisplayLanguage) {
    setLanguage(next);
    router.refresh();
  }
  return (
    <nav aria-label="Language" className="mb-5 flex justify-end gap-2">
      {(['fa', 'en'] as const).map((choice) => (
        <button
          key={choice}
          type="button"
          aria-pressed={language === choice}
          className={cn(
            'rounded-lg border px-3 py-1.5 text-sm font-semibold',
            tone === 'inverse'
              ? 'border-white/40 text-white hover:bg-white/10 aria-pressed:bg-white aria-pressed:text-blue-950'
              : 'border-border aria-pressed:bg-primary aria-pressed:text-primary-foreground',
          )}
          onClick={() => choose(choice)}
        >
          {choice === 'en'
            ? 'English'
            : language === 'en'
              ? 'Persian'
              : 'فارسی'}
        </button>
      ))}
    </nav>
  );
}
