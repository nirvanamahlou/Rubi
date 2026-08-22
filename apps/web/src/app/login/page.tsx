import type { Metadata } from 'next';
import Image from 'next/image';
import { Suspense } from 'react';

import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'ورود امن' };

function CompanyLogos({ compact = false }: { compact?: boolean }) {
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
          <Image
            alt="لوگوی شرکت نیایش سیر"
            className={compact ? 'object-contain p-2' : 'object-contain p-3'}
            fill
            priority={!compact}
            sizes={compact ? '45vw' : '220px'}
            src="/brand/niyayesh-seir-full.png"
          />
        </div>
        <div
          className={
            compact
              ? 'relative h-28 overflow-hidden rounded-2xl border bg-white shadow-sm'
              : 'relative h-44 overflow-hidden rounded-2xl bg-white shadow-lg shadow-blue-950/20'
          }
        >
          <Image
            alt="لوگوی شرکت جهان باستان"
            className={compact ? 'object-contain p-2' : 'object-contain p-3'}
            fill
            priority={!compact}
            sizes={compact ? '45vw' : '220px'}
            src="/brand/jahan-bastan.png"
          />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main
      className="grid min-h-screen place-items-center px-4 py-10"
      id="main-content"
    >
      <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border bg-surface shadow-2xl shadow-blue-950/10 lg:grid-cols-[1.1fr_1fr]">
        <div className="hidden bg-[linear-gradient(145deg,#123f8c,#092354)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <CompanyLogos />
          <div>
            <h1 className="text-3xl font-black">سامانه یکپارچه آژانس</h1>
            <p className="mt-3 text-blue-100">
              ورود امن کارکنان و مدیریت دسترسی مبتنی بر نقش و شعبه
            </p>
          </div>
        </div>
        <div className="p-7 sm:p-12">
          <div className="mb-8 lg:hidden">
            <CompanyLogos compact />
          </div>
          <h2 className="text-2xl font-black">ورود به سامانه</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            نام کاربری اختصاص‌یافته توسط مدیر و رمز عبور خود را وارد کنید.
          </p>
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
