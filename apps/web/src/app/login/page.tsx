import { localizedMetadata } from '@/i18n/metadata';
import type { Metadata } from 'next';
import { CompanyLogos } from './login-company-logos';
import { Suspense } from 'react';

import { LoginBackgroundStory } from './login-background-story';
import { LoginForm } from './login-form';
import { LanguageSwitcher } from '@/i18n/language-switcher';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata({ title: { absolute: 'ورود امن نورا' } });
}

export default function LoginPage() {
  return (
    <main
      className="relative grid min-h-screen place-items-center overflow-hidden bg-sky-100 px-4 pb-10 pt-36 lg:py-10"
      id="main-content"
    >
      <LoginBackgroundStory
        video={{
          src: '/brand/login-noora.mp4?v=engine-vapor-2',
          poster: '/brand/login-noora-poster.png?v=engine-vapor-2',
        }}
      />
      <section className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/50 bg-surface/95 shadow-2xl shadow-blue-950/20 backdrop-blur-sm lg:grid-cols-[1.1fr_1fr]">
        <div className="hidden bg-[linear-gradient(145deg,#123f8c,#092354)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <CompanyLogos />
          <div>
            <h1 className="text-3xl font-black">سامانه یکپارچه آژانس نورا</h1>
            <p className="mt-3 text-blue-100">
              ورود امن کارکنان و مدیریت دسترسی مبتنی بر نقش و شعبه
            </p>
          </div>
        </div>
        <div className="p-7 sm:p-12">
          <LanguageSwitcher />
          <div className="mb-8 lg:hidden">
            <CompanyLogos compact />
          </div>
          <h1 className="mb-3 text-xl font-black lg:hidden">
            سامانه یکپارچه آژانس نورا
          </h1>
          <h2 className="text-2xl font-black">ورود به سامانه</h2>
          <Suspense
            fallback={
              <p className="mt-8 text-sm text-muted-foreground">
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
