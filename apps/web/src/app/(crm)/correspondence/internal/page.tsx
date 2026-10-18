import Link from 'next/link';
import { Send, Inbox } from 'lucide-react';
export default function Page() {
  return (
    <section dir="rtl" className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">مکاتبات داخلی</h1>
        <Link href="/correspondence" className="text-primary underline">
          بازگشت به مکاتبات
        </Link>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {[
          {
            href: '/correspondence/internal/send',
            title: 'ارسال',
            description: 'تهیه نامه و ارسال به کاربران سامانه',
            Icon: Send,
          },
          {
            href: '/correspondence/internal/received',
            title: 'دریافت',
            description: 'مشاهده و پیگیری نامه‌های دریافتی',
            Icon: Inbox,
          },
        ].map(({ href, title, description, Icon }) => (
          <Link
            key={href}
            href={href}
            className="rounded-2xl border bg-surface p-7 shadow-sm transition hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="mb-5 inline-flex rounded-2xl bg-primary/10 p-4 text-primary">
              <Icon className="size-7" />
            </span>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
