import { sources, operators, type Call } from './model';

/** Entirely fictional preview fixtures; no customer data and no persistence. */
export function previewCalls(): Call[] {
  const names = [
    'مسافر نمونه ۱',
    'مسافر نمونه ۲',
    'مسافر نمونه ۳',
    'مسافر نمونه ۴',
    'مسافر نمونه ۵',
    'مسافر نمونه ۶',
    'مسافر نمونه ۷',
    'مسافر نمونه ۸',
    'مسافر نمونه ۹',
    'مسافر نمونه ۱۰',
  ];
  const subjects = [
    'استعلام قیمت تور استانبول',
    'پیگیری ویزای تحصیلی',
    'رزرو هتل کیش',
    'اقساط تور آنتالیا',
    'شکایت / تغییر تاریخ پرواز',
    'استعلام تور دبی',
    'اطلاعات تور اروپا',
    'رزرو هتل استانبول',
    'استعلام تور مشهد',
    'ویزای توریستی کانادا',
  ];
  return names.flatMap((name, index) => {
    const count = [4, 3, 2, 1, 6, 2, 3, 2, 1, 3][index]!;
    return Array.from({ length: count }, (_, step): Call => ({
      id: `preview-${index}-${step}`,
      phone: `091200000${String(index + 1).padStart(2, '0')}`,
      occurredAt: new Date(
        Date.UTC(2026, 9, 18, 9, 30) -
          index * 1800000 -
          (count - step - 1) * 86400000,
      ).toISOString(),
      direction: step === 0 ? 'INBOUND' : 'OUTBOUND',
      recordings: [],
      name,
      subject: subjects[index]!,
      source: sources[index % sources.length]!,
      operator: operators[index % operators.length]!,
      status: (
        [
          'پیگیری سوم',
          'پیگیری دوم',
          'پیگیری اول',
          'جدید',
          'منتظر تماس مجدد',
          'بدون پاسخ',
          'نهایی شده',
          'پیگیری اول',
          'جدید',
          'پیگیری دوم',
        ] as const
      )[index]!,
      note:
        step === 0
          ? 'بررسی زمان سفر و حدود بودجه مسافر.'
          : 'شرایط سفر بررسی شد؛ نتیجه در تماس بعدی پیگیری می‌شود.',
    }));
  });
}
