import Link from 'next/link';
export default function Page() {
  return (
    <section dir="rtl" className="min-h-96">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">مکاتبات داخلی</h1>
        <Link href="/correspondence" className="text-primary underline">
          بازگشت به مکاتبات
        </Link>
      </div>
    </section>
  );
}
