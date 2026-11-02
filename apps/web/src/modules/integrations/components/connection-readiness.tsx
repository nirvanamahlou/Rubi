'use client';

import { useUiTranslation } from '@/i18n/locale-context';
import { Card } from '@/components/ui/surfaces';

export function ConnectionReadiness() {
  const t = useUiTranslation();
  return (
    <Card className="grid gap-4 p-5">
      <div>
        <h2 className="text-lg font-bold">
          {t('راهنمای اتصال سامانه‌های دیگر')}
        </h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          {t(
            'بسته اختصاصی قسطی‌رو در بخش بالا ثبت و آزمایش می‌شود. برای سایر سایت‌ها، ثبت مشخصات و روش ارتباط به‌تنهایی اتصال ایجاد نمی‌کند.',
          )}
        </p>
      </div>
      <ol className="grid gap-4 sm:grid-cols-3">
        {[
          [
            '۱',
            'ثبت سایت',
            'از «افزودن سایت» نام، برند و نشانی سایت را ثبت کنید. این مرحله اکنون قابل استفاده است.',
          ],
          [
            '۲',
            'بررسی دسترسی سایت',
            'مستندات API و امکان اتصال باید با مدیر سایت بررسی شود. رمز و توکن را در نشانی‌ها وارد نکنید.',
          ],
          [
            '۳',
            'راه‌اندازی و آزمون اتصال',
            'اتصال سازگار با سایت باید پیاده‌سازی و با دسترسی امن آزمایش شود؛ سپس انتقال داده و پایش آن فعال می‌شود.',
          ],
        ].map(([number, title, description]) => (
          <li key={number} className="rounded-xl border border-border p-4">
            <span
              aria-hidden="true"
              className="mb-3 inline-flex size-7 items-center justify-center rounded-full bg-muted text-sm font-bold text-primary"
            >
              {number}
            </span>
            <h3 className="text-sm font-bold">{t(title!)}</h3>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {t(description!)}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
