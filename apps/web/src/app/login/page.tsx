import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { CompanyLogos } from './login-company-logos';
import { Suspense } from 'react';

import { LoginForm } from './login-form';
import { LanguageSwitcher } from '@/i18n/language-switcher';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: { absolute: 'ورود امن نورا' } });
}

export default function LoginPage() {
  return (
    <main
      className="relative grid min-h-screen place-items-center overflow-hidden bg-white px-4 pb-10 pt-36 lg:py-10"
      id="main-content"
    >
      <section className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/50 bg-[linear-gradient(145deg,#123f8c,#092354)] shadow-2xl shadow-blue-950/20 lg:grid-cols-[1.1fr_1fr]">
        <div className="hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <CompanyLogos />
          <div>
            <h1 className="text-3xl font-black">سامانه یکپارچه آژانس نورا</h1>
            <p className="mt-3 text-blue-100">
              ورود امن کارکنان و مدیریت دسترسی مبتنی بر نقش و شعبه
            </p>
          </div>
        </div>
        <div className="p-7 text-white sm:p-12">
          <LanguageSwitcher tone="inverse" />
          <div className="mb-8 lg:hidden">
            <CompanyLogos compact />
          </div>
          <h1 className="mb-3 text-xl font-black lg:hidden">
            سامانه یکپارچه آژانس نورا
          </h1>
          <h2 className="text-2xl font-black text-white">ورود به سامانه</h2>
          <Suspense
            fallback={
              <p className="mt-8 text-sm text-blue-100">
                در حال آماده‌سازی فرم ورود…
              </p>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
