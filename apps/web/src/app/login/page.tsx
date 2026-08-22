import type { Metadata } from 'next';
import Image from 'next/image';
import { Suspense } from 'react';

import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'ورود امن' };

export default function LoginPage() {
  return (
    <main
      className="grid min-h-screen place-items-center px-4 py-10"
      id="main-content"
    >
      <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border bg-surface shadow-2xl shadow-blue-950/10 lg:grid-cols-[1.1fr_1fr]">
        <div className="hidden bg-[linear-gradient(145deg,#123f8c,#092354)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
          <Image
            alt="لوگوی شرکت نیایش سیر سحر"
            className="h-auto w-72 rounded-2xl bg-white p-3"
            height={710}
            priority
            src="/brand/niyayesh.png"
            width={1758}
          />
          <div>
            <h1 className="text-3xl font-black">سامانه یکپارچه روبی</h1>
            <p className="mt-3 text-blue-100">
              ورود امن کارکنان و مدیریت دسترسی مبتنی بر نقش و شعبه
            </p>
          </div>
        </div>
        <div className="p-7 sm:p-12">
          <div className="mb-8 lg:hidden">
            <Image
              alt="لوگوی شرکت"
              className="h-auto w-56"
              height={710}
              src="/brand/niyayesh.png"
              width={1758}
            />
          </div>
          <h2 className="text-2xl font-black">ورود به سامانه</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            ایمیل سازمانی و رمز عبور خود را وارد کنید.
          </p>
            <Suspense fallback={<p className="mt-8 text-sm text-muted-foreground">در حال آماده‌سازی فرم ورود…</p>}>
              <LoginForm />
            </Suspense>
        </div>
      </section>
    </main>
  );
}
