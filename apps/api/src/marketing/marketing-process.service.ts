import { Injectable } from '@nestjs/common';
import {
  MARKETING_PROCESS_CONTRACT_VERSION,
  type MarketingProcessProjectionV1,
  type MarketingProcessStageV1,
} from '@nora/contracts';

const PROCESS_STAGES = [
  {
    key: 'STRATEGY',
    order: 1,
    title: 'تدوین استراتژی بازاریابی',
    ownerModule: 'Marketing',
    status: 'INFRASTRUCTURE_PENDING',
    description:
      'هدف، بازار، مشتری هدف، جایگاه برند، بودجه و شاخص‌های برنامه بازاریابی.',
    trackedFields: [
      'هدف کسب‌وکار',
      'بازه برنامه',
      'مخاطب هدف',
      'بودجه و ارز',
      'شاخص‌های هدف',
    ],
    missingCapabilities: [
      'MarketingPlan persistence',
      'گردش تأیید نسخه‌دار برنامه',
    ],
    action: {
      label: 'جایگاه برنامه بازاریابی',
      href: '/marketing?section=campaigns',
      available: false,
    },
  },
  {
    key: 'ACQUISITION',
    order: 2,
    title: 'جذب مشتری بالقوه',
    ownerModule: 'Marketing + Customer Affairs',
    status: 'PARTIAL',
    description:
      'منبع، کانال، B2B/B2C و UTM باید همراه سرنخ تا CRM منتقل شوند.',
    trackedFields: ['منبع ورود', 'کانال ورودی', 'نوع B2B/B2C', 'کمپین و UTM'],
    missingCapabilities: [
      'campaignReference روی Lead عملیاتی',
      'ثبت Touchpoint و مدل Attribution مصوب',
    ],
    action: {
      label: 'مشاهده سرنخ‌ها',
      href: '/customer-affairs?view=leads',
      available: true,
    },
  },
  {
    key: 'SEGMENTATION',
    order: 3,
    title: 'بخش‌بندی مشتریان',
    ownerModule: 'Marketing + Customers',
    status: 'INFRASTRUCTURE_PENDING',
    description:
      'Marketing قواعد سگمنت را نگه می‌دارد و Customers شمارش و رضایت را محاسبه می‌کند.',
    trackedFields: [
      'نسخه قواعد',
      'نوع مشتری یا آژانس',
      'شمارش واجد شرایط',
      'رضایت و Suppression',
    ],
    missingCapabilities: [
      'Segment persistence',
      'Customers audience public contract',
      'materialization بدون PII',
    ],
    action: {
      label: 'جایگاه سگمنت‌ها',
      href: '/marketing?section=audiences',
      available: false,
    },
  },
  {
    key: 'CRM',
    order: 4,
    title: 'مدیریت ارتباط با مشتری',
    ownerModule: 'Customer Affairs + Customers',
    status: 'AVAILABLE',
    description:
      'درخواست، Lead، پیگیری، Qualification، Timeline و تحویل نسخه‌دار به فروش.',
    trackedFields: [
      'شناسه پیگیری',
      'مرحله Lead',
      'مسئول',
      'اقدام بعدی',
      'تاریخچه ارتباط',
    ],
    missingCapabilities: [],
    action: {
      label: 'ورود به امور مشتریان',
      href: '/customer-affairs',
      available: true,
    },
  },
  {
    key: 'SALES',
    order: 5,
    title: 'فرایند فروش',
    ownerModule: 'Sales',
    status: 'AVAILABLE',
    description:
      'پیشنهاد، قرارداد، پرداخت‌کننده، مسافر، خدمات و درخواست اجرای رزرواسیون.',
    trackedFields: [
      'قرارداد',
      'وضعیت تأیید',
      'مبلغ و ارز',
      'خدمات تخصیص‌یافته',
    ],
    missingCapabilities: [],
    action: {
      label: 'ورود به فروش',
      href: '/sales',
      available: true,
    },
  },
  {
    key: 'TRAVEL_SERVICE',
    order: 6,
    title: 'ارائه خدمات سفر',
    ownerModule: 'Reservations',
    status: 'AVAILABLE',
    description:
      'اجرای Snapshot قرارداد، بلیت، هتل، تور، بیمه، ویزا و وضعیت تحویل خدمت.',
    trackedFields: [
      'درخواست اجرا',
      'وضعیت عملیات',
      'صدور و رزرو',
      'تحویل و لغو',
    ],
    missingCapabilities: [],
    action: {
      label: 'ورود به رزرواسیون',
      href: '/reservations',
      available: true,
    },
  },
  {
    key: 'LOYALTY',
    order: 7,
    title: 'حفظ و وفاداری مشتری',
    ownerModule: 'Customer Affairs + Customers',
    status: 'PARTIAL',
    description:
      'رضایت، شکایت و اقدام اصلاحی ثبت می‌شوند؛ باشگاه و چرخه خرید مجدد هنوز مالک عملیاتی ندارد.',
    trackedFields: ['رضایت', 'شکایت', 'اقدام اصلاحی', 'ارجاع'],
    missingCapabilities: [
      'Loyalty program owner contract',
      'سطح و امتیاز وفاداری',
      'خرید مجدد منتسب',
    ],
    action: {
      label: 'مشاهده پشتیبانی و رضایت',
      href: '/customer-affairs?view=satisfaction',
      available: true,
    },
  },
  {
    key: 'ANALYTICS',
    order: 8,
    title: 'تحلیل و بهبود عملکرد',
    ownerModule: 'Reporting',
    status: 'PARTIAL',
    description:
      'گزارش Lead و فروش موجود است؛ عملکرد کمپین، CAC و ROAS به Fact و Attribution معتبر نیاز دارد.',
    trackedFields: ['نرخ تبدیل Lead', 'فروش', 'رضایت', 'وضعیت اجرای سفر'],
    missingCapabilities: [
      'reporting_campaign_facts_v1',
      'مدل Attribution مصوب',
      'مرجع هزینه و درآمد منتسب',
    ],
    action: {
      label: 'ورود به گزارش‌ها',
      href: '/reports',
      available: true,
    },
  },
] as const satisfies readonly MarketingProcessStageV1[];

@Injectable()
export class MarketingProcessService {
  process(now = new Date()): MarketingProcessProjectionV1 {
    return {
      contractVersion: MARKETING_PROCESS_CONTRACT_VERSION,
      generatedAt: now.toISOString(),
      persistenceStatus: 'INFRASTRUCTURE_PENDING',
      stages: PROCESS_STAGES,
    };
  }
}
