'use client';
import { useRouter } from 'next/navigation';
import { useSystemPreferences } from '@/components/system-preferences-provider';
import type { DisplayLanguage } from './language';

export function LanguageSwitcher() {
  const { language, setLanguage } = useSystemPreferences();
  const router = useRouter();
  function choose(next: DisplayLanguage) {
    setLanguage(next);
    router.refresh();
  }
  return <nav aria-label="Language" className="mb-5 flex justify-end gap-2">
    {(['fa', 'en'] as const).map((choice) => <button key={choice} type="button" aria-pressed={language === choice}
      className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold aria-pressed:bg-primary aria-pressed:text-primary-foreground"
      onClick={() => choose(choice)}>{choice === 'en' ? 'English' : language === 'en' ? 'Persian' : 'فارسی'}</button>)}
  </nav>;
}
