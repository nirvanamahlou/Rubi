import Link from 'next/link';
import { ArrowDownToLine, ArrowUpFromLine, MessagesSquare } from 'lucide-react';

export function CorrespondenceWorkspace() {
  return (
    <section dir="rtl" className="space-y-6">
      <h1 className="text-2xl font-bold">مکاتبات</h1>
      <div className="grid gap-5 md:grid-cols-3">
        {[
          {
            href: '/correspondence/incoming',
            title: 'نامه‌های ورودی',
            icon: ArrowDownToLine,
          },
          {
            href: '/correspondence/outgoing',
            title: 'نامه‌های خروجی',
            icon: ArrowUpFromLine,
          },
          {
            href: '/correspondence/internal',
            title: 'مکاتبات داخلی',
            icon: MessagesSquare,
          },
        ].map(({ href, title, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex min-h-44 flex-col items-center justify-center gap-5 rounded-2xl border bg-surface p-6 shadow-sm transition hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="rounded-2xl bg-primary/10 p-4 text-primary">
              <Icon className="size-7" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-bold">{title}</h2>
          </Link>
        ))}
      </div>
    </section>
  );
}
