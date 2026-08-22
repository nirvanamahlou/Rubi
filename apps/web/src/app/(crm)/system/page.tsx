import type { Metadata } from 'next';
import { Building2, KeyRound, Settings2, UsersRound } from 'lucide-react';

import { ModuleOverview } from '@/components/modules/module-overview';

export const metadata: Metadata = { title: 'مدیریت سیستم' };

export default function Page() {
  return (
    <ModuleOverview
      description="ورودی یکپارچه مدیریت کاربران و تنظیمات؛ سرویس‌های IAM و تنظیمات در Backend همچنان مرز مستقل خود را حفظ می‌کنند."
      note="ادغام این دو مورد فقط در منوی کاربری است و به معنی یکی‌شدن جدول‌ها، قراردادهای API یا مسئولیت امنیتی آن‌ها نیست."
      sections={[
        {
          title: 'کاربران',
          icon: UsersRound,
          items: [
            'ایجاد، ویرایش، فعال‌سازی و غیرفعال‌سازی کاربر',
            'پروفایل کاری، شعبه اصلی و وضعیت دسترسی',
            'نشست‌های فعال و تاریخچه ورودهای امنیتی',
          ],
        },
        {
          title: 'نقش‌ها و مجوزها',
          icon: KeyRound,
          items: [
            'نقش‌های سازمانی و مجوزهای عملیاتی هر بخش',
            'محدوده شعبه و جداسازی مشاهده از اقدام',
            'کنترل عملیات حساس و گزارش Audit',
          ],
        },
        {
          title: 'شعب و ساختار سازمانی',
          icon: Building2,
          items: [
            'تعریف شعبه و انتساب کاربران',
            'سیاست دسترسی بین شعب و نمای مدیریتی',
            'مسئولان تایید و زنجیره جانشینی',
          ],
        },
        {
          title: 'تنظیمات سامانه',
          icon: Settings2,
          items: [
            'شماره‌گذاری، قالب‌ها و تنظیمات هر ماژول',
            'اعلان‌ها، زمان‌بندی‌ها و ویژگی‌های قابل فعال‌سازی',
            'تنظیمات امن Providerها بدون نمایش Secret',
          ],
        },
      ]}
      title="مدیریت سیستم"
    />
  );
}
