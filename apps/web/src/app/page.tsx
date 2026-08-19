import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center px-6 py-16">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
        <p className="mb-4 text-sm font-semibold tracking-wide text-teal-700">
          RUBI AIRLINE CRM
        </p>
        <h1 className="text-3xl font-bold leading-relaxed text-slate-900 sm:text-5xl">
          اسکلت فنی با موفقیت اجرا شد.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
          این صفحه فقط وضعیت آماده‌بودن Web App را نشان می‌دهد. قابلیت‌ها و
          صفحات تجاری CRM در این مرحله پیاده‌سازی نشده‌اند.
        </p>
        <Link
          className="mt-8 inline-flex rounded-xl bg-teal-700 px-5 py-3 font-medium text-white transition hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          href="/status"
        >
          مشاهده وضعیت فنی
        </Link>
      </section>
    </main>
  );
}
