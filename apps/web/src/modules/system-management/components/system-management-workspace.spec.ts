import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const catalog = readFileSync(
  new URL('../model/settings-catalog.ts', import.meta.url),
  'utf8',
);

describe('system settings catalog', () => {
  it('includes every settings module and its reference card catalog', () => {
    for (const title of [
      'سازمان و نمایش',
      'مشتریان B2c',
      'امور مشتریان و پشتیبانی',
      'فروش، قرارداد و قیمت‌گذاری',
      'بلیت و برنامه سفر',
      'رزرواسیون و خدمات سفر',
      'تنخواه',
      'بازاریابی',
      'مشتریان B2B',
      'منابع انسانی',
      'میزکار',
      'پیام و اعلان',
      'اسناد و فایل‌ها',
      'گزارش و نمای مدیریتی',
      'اطلاعات پایه',
    ])
      expect(catalog).toContain(title);

    expect(catalog).not.toContain('مالی و خزانه‌داری');
    expect(catalog).not.toContain("m('finance'");
    expect(catalog).not.toContain('کاربران و امنیت');
    expect(catalog).not.toContain("m('access'");
    expect(catalog).toContain('شماره‌گذاری اسناد');
    expect(catalog).not.toContain('اتصال‌ها و دو سایت');
    expect(catalog).not.toContain("m('integrations'");
    expect(catalog).not.toContain('پاسخ و بازیابی اتصال');
    expect(catalog).not.toContain('Webhook و همگام‌سازی');
    expect(catalog).not.toContain('پیش‌فرض دو وب‌سایت');
    expect(catalog).not.toContain('سلامت و هشدار سرویس');
    expect(catalog).toContain('خروجی و فایل گزارش');
    expect(catalog).not.toContain('برند و اسناد صادره');
    expect(catalog).not.toContain("'branding'");
    expect(catalog).not.toContain('شرکت صادرکننده پیش‌فرض');
    expect(catalog).not.toContain('سربرگ پیش‌فرض');
    expect(catalog).not.toContain('پیگیری و تحویل سرنخ');
    expect(catalog).not.toContain("'leads'");
    expect(catalog).not.toContain("g('contact', 'ارتباط با مشتری'");
    expect(catalog).not.toContain('کانال ترجیحی');
    expect(catalog).not.toContain('یادآوری تکمیل پرونده');
    expect(catalog).not.toContain('مرجع تأیید ادغام');
    expect(catalog).not.toContain('زبان ارتباط');
    expect(catalog).not.toContain('هشدار مصرف مهلت');
    expect(catalog).not.toContain('بستن و رضایت‌سنجی');
    expect(catalog).not.toContain('ارسال نظرسنجی پس از حل');
    expect(catalog).not.toContain('فاصله ارسال نظرسنجی');
    expect(catalog).not.toContain('نمایش کاتالوگ‌ها');
    expect(catalog).not.toContain('میزکار و اتوماسیون');
    expect(catalog).not.toContain("g('catalog', 'نمایش کاتالوگ‌ها'");
    expect(catalog).toContain(
      'در حال بررسی|در انتظار تکمیل مدارک|تأیید مشروط|فعال|معلق|غیرفعال|ردشده',
    );
    expect(catalog).toContain(
      'مدیر تأمین|سرپرست اطلاعات پایه|مدیر عملیات|مدیر مالی|مدیر ارشد اجرایی|کمیته ارزیابی تأمین‌کنندگان',
    );
    expect(catalog).toContain(
      'مدیر مالی|مسئول نرخ ارز|سرپرست خزانه‌داری|مدیر حسابداری|مدیر ارشد مالی|کمیته نرخ ارز',
    );
    expect(catalog).toContain('بستن درخواست');
    expect(catalog).not.toContain('رضایت و حریم خصوصی');
    expect(catalog).not.toContain("'consentChannel'");
    expect(catalog).not.toContain('ثبت رضایت از طریق');
    expect(catalog).not.toContain('اعلان خروجی حساس به مسئول');
    expect(catalog).not.toContain('قیمت کانال‌های فروش');
    expect(catalog).not.toContain("g('channels'");
    expect(catalog).not.toContain('کانال مشمول');
    expect(catalog).not.toContain('درصد افزایش قیمت');
    expect(catalog).not.toContain('هوایی، قطار و اتوبوس');
    expect(catalog).not.toContain("g('transport'");
    expect(catalog).not.toContain('حمل‌ونقل پیش‌فرض');
    expect(catalog).not.toContain('هشدار اتصال کوتاه سفر');
    expect(catalog).not.toContain('پکیج و نوبت تور');
    expect(catalog).not.toContain("g('tour'");
    expect(catalog).not.toContain('الگوی برنامه سفر');
    expect(catalog).not.toContain('اجرای خودکار');
    expect(catalog).not.toContain("g('execution'");
    expect(catalog).not.toContain('گیرنده خطای اجرا');
    expect(catalog).not.toContain('چیدمان پیش‌فرض');
    expect(catalog).not.toContain("'layout'");
    expect(catalog).not.toContain('درخواست و تأیید داخلی');
    expect(catalog).not.toContain("g('approval'");
    expect(catalog).not.toContain('مهلت پاسخ مدیر');
    expect(catalog).not.toContain('انتساب و رهگیری');
    expect(catalog).not.toContain("g('attribution'");
    expect(catalog).not.toContain('الزام UTM برای لینک کمپین');
    expect(catalog).not.toContain('کاربران و همکاری');
    expect(catalog).not.toContain("g('portal'");
    expect(catalog).not.toContain('تأیید کاربر سازمان');
    expect(catalog).not.toContain('استعلام و تأمین‌کننده');
    expect(catalog).not.toContain("g('quotations'");
    expect(catalog).not.toContain('خرید اضطراری و برآورد');
    expect(catalog).not.toContain("g('emergency'");
    expect(catalog).not.toContain('فرم کارگزار و واچر هتل');
    expect(catalog).not.toContain("g('hotel'");
    expect(catalog).not.toContain('قالب فرم کارگزار');
    expect(catalog).not.toContain('استعلام و نگهداشت ظرفیت');
    expect(catalog).not.toContain("g('hold'");
    expect(catalog).not.toContain('مهلت Hold پرواز');
    expect(catalog).not.toContain('صدور و مدیریت خطا');
    expect(catalog).not.toContain("g('issuance'");
    expect(catalog).not.toContain('صدور خودکار پس از کنترل‌ها');
    expect(catalog).not.toContain('ارزیابی و آموزش');
    expect(catalog).not.toContain("g('performance'");
    expect(catalog).not.toContain('فعال‌بودن خودارزیابی');
    expect(catalog).not.toContain('قالب فیش');
    expect(catalog).not.toContain('فیش استاندارد فارسی');
    expect(catalog).not.toContain('فیش دوزبانه');
    expect(catalog).not.toContain('پرداخت و استرداد');
    expect(catalog).not.toContain('آزادسازی مدارک سفر');
    expect(catalog).not.toContain('چک و یادآوری سررسید');
    expect(catalog).not.toContain('تطبیق بانکی و تسویه');
    expect(catalog).not.toContain('نرخ ارز و دریافت‌ها');
    expect(catalog).toContain("t('templateName', 'نام قالب'");
    expect(catalog).toContain("'templateFile'");
    expect(catalog).toContain("type: 'file'");
    expect(catalog).not.toContain(
      "s(\n          'template',\n          'قالب قرارداد'",
    );
  });
});
