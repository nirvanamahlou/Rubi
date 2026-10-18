export const sources = [
  'اینستاگرام',
  'گوگل',
  'سایت',
  'تلگرام',
  'معرفی دوستان',
] as const;
export const operators = [
  'کارشناس تور خارجی',
  'واحد ویزا',
  'فروش داخلی',
  'پشتیبانی',
] as const;
export const statuses = [
  'جدید',
  'پیگیری اول',
  'پیگیری دوم',
  'پیگیری سوم',
  'منتظر تماس مجدد',
  'بدون پاسخ',
  'نهایی شده',
] as const;
export type Status = (typeof statuses)[number];
export type Direction = 'INBOUND' | 'OUTBOUND';
/** Module-local UI input, not a published provider API contract. Times are UTC ISO. */
export interface CallEvent {
  id: string;
  phone: string;
  occurredAt: string;
  direction: Direction;
  recordings: { id: string; url: string; title: string }[];
}
export interface Call extends CallEvent {
  name: string;
  subject: string;
  source: string;
  operator: string;
  status: Status;
  note: string;
}
export interface Contact {
  phone: string;
  latest: Call;
  calls: Call[];
  followUps: number;
}
export function normalizePhone(value: string) {
  let phone = value
    .replace(/[۰-۹]/g, (n) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(n)))
    .replace(/[٠-٩]/g, (n) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(n)))
    .replace(/[\s()-]/g, '');
  if (phone.startsWith('0098')) phone = '0' + phone.slice(4);
  if (phone.startsWith('+98')) phone = '0' + phone.slice(3);
  return phone;
}
export function validPhone(value: string) {
  return /^(?:0\d{10}|\+[1-9]\d{7,14})$/.test(normalizePhone(value));
}
export function saveCall(calls: Call[], call: Call): Call[] {
  if (!validPhone(call.phone) || !Number.isFinite(Date.parse(call.occurredAt)))
    throw new Error('شماره تلفن یا زمان تماس معتبر نیست.');
  // An event replay updates its metadata without creating a second follow-up.
  return [
    ...calls.filter((item) => item.id !== call.id),
    { ...call, phone: normalizePhone(call.phone) },
  ];
}
export function groupCalls(calls: Call[]): Contact[] {
  const groups = new Map<string, Call[]>();
  for (const call of calls) {
    const key = normalizePhone(call.phone);
    groups.set(key, [...(groups.get(key) ?? []), call]);
  }
  return [...groups.entries()]
    .map(([phone, items]) => {
      items.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
      return {
        phone,
        latest: items[0]!,
        calls: items,
        followUps: items.length - 1,
      };
    })
    .sort(
      (a, b) =>
        Date.parse(b.latest.occurredAt) - Date.parse(a.latest.occurredAt),
    );
}
export function filterContacts(
  contacts: Contact[],
  filters: {
    query: string;
    direction: string;
    source: string;
    operator: string;
    status: string;
  },
) {
  const query = normalizePhone(filters.query.trim()).toLocaleLowerCase('fa');
  return contacts.filter(
    ({ latest, phone }) =>
      (!query ||
        normalizePhone(`${latest.name} ${phone} ${latest.subject}`)
          .toLocaleLowerCase('fa')
          .includes(query)) &&
      (!filters.direction || latest.direction === filters.direction) &&
      (!filters.source || latest.source === filters.source) &&
      (!filters.operator || latest.operator === filters.operator) &&
      (!filters.status || latest.status === filters.status),
  );
}
export const faNumber = (value: number) => value.toLocaleString('fa-IR');
export const callDate = (value: string) =>
  new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

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
