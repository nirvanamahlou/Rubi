import '@fontsource-variable/vazirmatn';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';

import { Providers } from '@/components/providers';
import {
  displayLanguageCookieName,
  parseDisplayLanguage,
} from '@/i18n/language';
import { translateUiText } from '@/i18n/translate';
import './globals.css';

const metadata: Metadata = {
  title: {
    default: 'CRM شرکت نیایش سیر سحر',
    template: '%s | نیایش سیر سحر',
  },
  description: 'رابط فارسی و یکپارچه مدیریت ارتباط با مشتری و عملیات سفر',
};

export async function generateMetadata(): Promise<Metadata> {
  const language =
    parseDisplayLanguage(
      (await cookies()).get(displayLanguageCookieName)?.value,
    ) ?? 'fa';
  return {
    ...metadata,
    title: {
      default: translateUiText('CRM شرکت نیایش سیر سحر', language),
      template:
        language === 'en' ? '%s | Niayesh Seir Sahar' : '%s | نیایش سیر سحر',
    },
    description:
      language === 'en'
        ? 'Integrated customer relationship and travel operations management'
        : metadata.description,
  };
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f7fd' },
    { media: '(prefers-color-scheme: dark)', color: '#08152d' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const initialLanguage = parseDisplayLanguage(
    (await cookies()).get(displayLanguageCookieName)?.value,
  );
  return (
    <html
      lang={initialLanguage ?? 'fa'}
      dir={initialLanguage === 'en' ? 'ltr' : 'rtl'}
      suppressHydrationWarning
    >
      <body>
        <Providers initialLanguage={initialLanguage}>
          <a className="skip-link" href="#main-content">
            رفتن به محتوای اصلی
          </a>
          {children}
        </Providers>
      </body>
    </html>
  );
}
