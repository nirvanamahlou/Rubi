import '@fontsource-variable/vazirmatn';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'CRM شرکت نیایش سیر سحر',
    template: '%s | نیایش سیر سحر',
  },
  description: 'رابط فارسی و یکپارچه مدیریت ارتباط با مشتری و عملیات سفر',
};

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f7fd' },
    { media: '(prefers-color-scheme: dark)', color: '#08152d' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main-content">
          رفتن به محتوای اصلی
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
