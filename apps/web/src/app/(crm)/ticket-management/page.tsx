import type { Metadata } from 'next';
import { CalendarClock, PlaneTakeoff, Tags, TicketCheck } from 'lucide-react';

import { ModuleOverview } from '@/components/modules/module-overview';

export const metadata: Metadata = { title: 'تعریف و مدیریت بلیت‌ها' };

export default function Page() {
  return (
    <ModuleOverview
      description="محل تعریف و ویرایش محصول بلیت، برنامه حرکت، نرخ و ظرفیت؛ صدور بلیت مسافر همچنان داخل رزرواسیون انجام می‌شود."
      note="در این بخش هیچ بلیتی برای مسافر صادر نمی‌شود. خروجی آن موجودی و قواعد فروشی است که فروش و رزرواسیون مصرف می‌کنند."
      sections={[
        {
          title: 'تعریف محصول بلیت',
          icon: TicketCheck,
          items: [
            'نوع حمل‌ونقل، مبدا، مقصد و کلاس خدمت',
            'ایرلاین یا شرکت حمل‌ونقل و شماره سرویس',
            'قوانین بار، تغییر، کنسلی و توضیحات مسافر',
          ],
        },
        {
          title: 'برنامه حرکت',
          icon: CalendarClock,
          items: [
            'تاریخ و ساعت حرکت و رسیدن با منطقه زمانی',
            'تکرار برنامه، توقف‌ها و وضعیت فعال یا لغو',
            'نسخه‌بندی تغییرات برنامه و اعلان مصرف‌کنندگان',
          ],
        },
        {
          title: 'نرخ و ظرفیت',
          icon: Tags,
          items: [
            'نرخ خرید، نرخ فروش، ارز و بازه اعتبار',
            'ظرفیت کل، فروخته‌شده، Hold و باقی‌مانده',
            'سهمیه شعبه، آژانس یا مشتری سازمانی',
          ],
        },
        {
          title: 'ظرفیت سازمانی شرکت',
          icon: PlaneTakeoff,
          badge: 'صدور داخلی',
          items: [
            'علامت‌گذاری ظرفیت‌هایی که در اختیار شرکت است',
            'قواعد استفاده در قراردادهای تور خود آژانس',
            'تغذیه صف صدور و منیفست رزرواسیون',
          ],
        },
      ]}
      title="تعریف و مدیریت بلیت‌ها"
    />
  );
}
