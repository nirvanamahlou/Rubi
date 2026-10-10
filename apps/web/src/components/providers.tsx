'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { faMessages } from '@/messages/fa';
import {
  SystemPreferencesProvider,
  useSystemPreferences,
} from './system-preferences-provider';
import { translateUiText } from '@/i18n/translate';
import type { DisplayLanguage } from '@/i18n/language';
import { ThemeProvider } from './theme-provider';
import { TooltipProvider } from './ui/overlays';

function localizeMessages<T>(value: T): T {
  if (typeof value === 'string') return translateUiText(value, 'en') as T;
  if (Array.isArray(value)) return value.map(localizeMessages) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        localizeMessages(entry),
      ]),
    ) as T;
  return value;
}

const englishMessages = localizeMessages(faMessages);

function ApplicationProviders({ children }: { children: ReactNode }) {
  const { language } = useSystemPreferences();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <NextIntlClientProvider
      locale={language}
      messages={language === 'en' ? englishMessages : faMessages}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

export function Providers({
  children,
  initialLanguage = null,
}: {
  children: ReactNode;
  initialLanguage?: DisplayLanguage | null;
}) {
  return (
    <SystemPreferencesProvider initialLanguage={initialLanguage}>
      <ApplicationProviders>{children}</ApplicationProviders>
    </SystemPreferencesProvider>
  );
}
