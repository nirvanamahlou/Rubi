export const sources = [
  'نامشخص',
  'اینستاگرام',
  'گوگل',
  'سایت',
  'تلگرام',
  'معرفی دوستان',
] as const;
export const operators = [
  'نامشخص',
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
  completionToken?: string;
  id: string;
  phone: string;
  occurredAt: string;
  direction: Direction;
  recordings: { id: string; url: string; title: string }[];
}
export interface Call extends CallEvent {
  answerRecipient?: {
    extension: string;
    label: string;
    shared: boolean;
    answeredAt: string | null;
    observedAt?: string;
    labelSource?: 'CURRENT_DIRECTORY';
  };
  needsCompletion?: boolean | null;
  ticketId?: string | null;
  outcome?: string | null;
  origin?: string | null;
  createdByUserId?: string;
  createdAt?: string;
  contactId?: string;
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
  if (/^98\d{10}$/.test(phone)) phone = '0' + phone.slice(2);
  if (/^9\d{9}$/.test(phone)) phone = '0' + phone;
  return phone;
}
export function validPhone(value: string) {
  return /^(?:\d{1,15}|\+[1-9]\d{1,14})$/.test(normalizePhone(value));
}
export function saveCall(calls: Call[], call: Call): Call[] {
  if (
    (call.phone && !validPhone(call.phone)) ||
    !Number.isFinite(Date.parse(call.occurredAt))
  )
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
    const key =
      normalizePhone(call.phone) || `unknown:${call.contactId ?? call.id}`;
    groups.set(key, [...(groups.get(key) ?? []), call]);
  }
  return [...groups.entries()]
    .map(([phone, items]) => {
      items.sort(
        (a, b) =>
          Date.parse(b.occurredAt) - Date.parse(a.occurredAt) ||
          a.id.localeCompare(b.id),
      );
      return {
        phone,
        latest: items[0]!,
        calls: items,
        followUps: items.length - 1,
      };
    })
    .sort(
      (a, b) =>
        Date.parse(b.latest.occurredAt) - Date.parse(a.latest.occurredAt) ||
        (a.latest.contactId ?? a.phone).localeCompare(
          b.latest.contactId ?? b.phone,
        ),
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
      (!filters.status ||
        latest.outcome === filters.status ||
        (!latest.outcome && latest.status === filters.status)),
  );
}
export const faNumber = (value: number) => value.toLocaleString('fa-IR');
export const callDate = (value: string) =>
  new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
