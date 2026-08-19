import Link from 'next/link';

import { getPublicApiBaseUrl } from '@/lib/environment';

export default function StatusPage() {
  const apiBaseUrl = getPublicApiBaseUrl();

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="size-3 rounded-full bg-emerald-500"
          />
          <h1 className="text-2xl font-bold text-slate-900">
            وضعیت Web App: آماده
          </h1>
        </div>
        <dl className="mt-8 grid gap-4 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="font-semibold text-slate-700">جهت و زبان</dt>
          <dd className="text-slate-600">فارسی / RTL</dd>
          <dt className="font-semibold text-slate-700">API پایه</dt>
          <dd className="break-all font-mono text-slate-600" dir="ltr">
            {apiBaseUrl}
          </dd>
          <dt className="font-semibold text-slate-700">Health endpoint</dt>
          <dd className="break-all font-mono text-slate-600" dir="ltr">
            {apiBaseUrl}/health
          </dd>
        </dl>
        <Link
          className="mt-8 inline-block font-medium text-teal-700 hover:underline"
          href="/"
        >
          بازگشت به صفحه اصلی
        </Link>
      </section>
    </main>
  );
}
