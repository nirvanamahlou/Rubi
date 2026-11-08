'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/overlays';

export const correctableInsuranceStatuses = [
  'DRAFT',
  'INPUT_ERROR',
  'PROVIDER_ERROR',
] as const;

export function canCorrectInsurance(status: string) {
  return correctableInsuranceStatuses.some((value) => value === status);
}

export function insuranceCorrectionHref(customerId: string) {
  return '/customers?' + new URLSearchParams({ customerId });
}

export function InsuranceRequirements({
  expanded = false,
}: {
  expanded?: boolean;
}) {
  return (
    <details className="rounded border p-3" open={expanded}>
      <summary>راهنمای اطلاعات لازم برای بیمه</summary>
      <ul className="mt-2 grid list-inside list-disc gap-2">
        <li>
          نام و نام خانوادگی فارسی و نام و نام خانوادگی لاتین را در پرونده
          مسافر، دقیقاً مطابق گذرنامه ثبت کنید.
        </li>
        <li>
          تاریخ تولد واقعی، جنسیت و تابعیت مسافر الزامی است. تاریخ را با انتخاب
          تقویم درست وارد کنید؛ سن جایگزین تاریخ تولد نیست.
        </li>
        <li>
          شماره گذرنامه را مطابق مدرک و برای مسافر ایرانی کد ملی را با حفظ صفر
          ابتدایی وارد کنید؛ از حروف و ارقام انگلیسی و بدون فاصله اضافی استفاده
          کنید.
        </li>
        <li>
          تلفن همراه و ایمیل معتبر مسافر لازم است؛ در نبود تماس مسافر، تماس
          مشتری قرارداد استفاده می‌شود.
        </li>
        <li>
          بیمه باید در قرارداد به همین مسافر تخصیص یافته باشد. کشور مقصد و طرح
          بیمه باید با تنظیمات شعبه مطابقت داشته باشند؛ تاریخ شروع سفر را از
          تقویم و مدت سفر را به تعداد روز ثبت کنید.
        </li>
      </ul>
      <p className="mt-2">
        پس از ذخیره اطلاعات مسافر، درخواست خودکار در نوبت بعد دوباره بررسی
        می‌شود. اگر اطلاعات قبلاً به بیمه‌گر ارسال شده باشد، تغییر آن ممکن است
        نیازمند بررسی بیمه‌گر باشد.
      </p>
      <p className="mt-2">
        اتصال فعلی آزمایشی تراویس است؛ خروجی آن پوشش واقعی سفر نیست. اصلاح
        پرونده مسافر، بیمه‌نامه صادرشده را تغییر نمی‌دهد.
      </p>
    </details>
  );
}

export function InsuranceCorrection({
  customerId,
  passengerName,
  disabled = false,
}: {
  customerId: string;
  passengerName: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          اصلاح بیمه
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
        <DialogTitle>اصلاح اطلاعات بیمه‌شده</DialogTitle>
        <DialogDescription>{passengerName}</DialogDescription>
        <InsuranceRequirements expanded />
        <Button asChild variant="outline">
          <Link
            href={insuranceCorrectionHref(customerId)}
            target="_blank"
            rel="noopener noreferrer"
            prefetch={false}
          >
            باز کردن پرونده مسافر برای اصلاح
          </Link>
        </Button>
        <p>
          پرونده در صفحه جدید باز می‌شود؛ اطلاعات هویتی، گذرنامه و تماس را اصلاح
          و ذخیره کنید، سپس برای مشاهده وضعیت بیمه به این صفحه برگردید.
        </p>
      </DialogContent>
    </Dialog>
  );
}
