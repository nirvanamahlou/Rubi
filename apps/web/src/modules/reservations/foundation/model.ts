export const sections = [
  ['dashboard', 'داشبورد'],
  ['inbox', 'صندوق درخواست‌ها'],
  ['tickets', 'صدور بلیط'],
  ['hotels', 'رزرو هتل'],
  ['vouchers', 'واچر'],
  ['insurance', 'بیمه سامان'],
  ['manifests', 'MANIFEST'],
  ['costs', 'هزینه خرید'],
  ['timeline', 'رویدادها'],
] as const;
export type Section = (typeof sections)[number][0];
export type ViewState =
  | 'LOADING'
  | 'EMPTY'
  | 'ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'SUCCESS'
  | 'NOT_CONFIGURED';
export type QueueStatus =
  | 'NEW'
  | 'ACTION_REQUIRED'
  | 'WAITING_SUPPLIER'
  | 'WAITING_FINANCE'
  | 'READY_FOR_DELIVERY'
  | 'ERROR'
  | 'COMPLETED'
  | 'SUPPLIER_CONFIRMED'
  | 'VOUCHER_ISSUED'
  | 'CANCELLED';
export const statusLabels: Record<QueueStatus, string> = {
  NEW: 'درخواست جدید',
  ACTION_REQUIRED: 'در انتظار اقدام',
  WAITING_SUPPLIER: 'ارسال‌شده به کارگزار',
  WAITING_FINANCE: 'در انتظار تأیید مالی',
  READY_FOR_DELIVERY: 'آماده تحویل',
  ERROR: 'خطادار',
  COMPLETED: 'تکمیل‌شده',
  SUPPLIER_CONFIRMED: 'آماده صدور واچر هتل',
  VOUCHER_ISSUED: 'واچر صادرشده',
  CANCELLED: 'ابطال‌شده',
};
export interface RequestView {
  id: string;
  contractNumber: string;
  branchId: string;
  branchName: string;
  issuerName: string;
  customerName: string;
  salesCounter: string;
  assignee: string | null;
  passengerNames: readonly string[];
  services: readonly (
    'FLIGHT' | 'TRAIN' | 'BUS' | 'HOTEL' | 'INSURANCE' | 'OTHER'
  )[];
  priority: 'NORMAL' | 'HIGH' | 'URGENT' | 'UNSPECIFIED';
  deadline: string | null;
  receivedAt?: string;
  travelDate?: string;
  destination?: string;
  hotelName?: string;
  hotelId?: string | undefined;
  serviceTitles?: readonly string[];
  mealServiceId?: string | undefined;
  mealServiceName?: string | undefined;
  hotelNotes?: string | undefined;
  carrierName?: string;
  destinationId?: string | undefined;
  checkIn?: string | undefined;
  checkOut?: string | undefined;
  roomCount?: number | undefined;
  singleRooms?: number | undefined;
  doubleRooms?: number | undefined;
  extraBeds?: number | undefined;
  hotelRequested?: boolean | undefined;
  hotelConfirmed?: boolean | undefined;
  correctedAt?: string | undefined;
  createdAt: string;
  status: QueueStatus;
  /** Counts issued documents once, not once per passenger/segment join. */
  issues: readonly { id: string; issuedAt: string }[];
}
export interface Query {
  search: string;
  status: QueueStatus | 'ALL';
  service: string;
  sort: 'deadline' | 'newest' | 'priority';
  page: number;
  pageSize: number;
  dateBasis: 'createdAt' | 'receivedAt' | 'travelDate';
  fromDate: string;
  toDate: string;
}
export const defaultQuery: Query = {
  search: '',
  status: 'ALL',
  service: 'ALL',
  sort: 'deadline',
  page: 1,
  pageSize: 10,
  dateBasis: 'createdAt',
  fromDate: '',
  toDate: '',
};
export const serviceLabels: Record<RequestView['services'][number], string> = {
  FLIGHT: 'هواپیما',
  TRAIN: 'قطار',
  BUS: 'اتوبوس',
  HOTEL: 'هتل',
  INSURANCE: 'بیمه',
  OTHER: 'سایر خدمات',
};
export interface ViewAccess {
  authenticated: boolean;
  permissions: readonly string[];
  branchIds: readonly string[];
}
export function accessibleRows(
  rows: readonly RequestView[],
  access: ViewAccess,
): RequestView[] {
  if (
    !access.authenticated ||
    !access.permissions.includes('reservations.read')
  )
    return [];
  return rows.filter((row) => access.branchIds.includes(row.branchId));
}
export function queryRows(rows: readonly RequestView[], query: Query) {
  const search = query.search.trim().toLocaleLowerCase('fa');
  const priority = { UNSPECIFIED: -1, NORMAL: 0, HIGH: 1, URGENT: 2 };
  const dateError = validateDateRange(query.fromDate, query.toDate);
  const filtered = rows.filter(
    (r) =>
      !dateError &&
      matchesDateRange(r, query) &&
      (query.status === 'ALL' || r.status === query.status) &&
      (query.service === 'ALL' ||
        r.services.some((s) => s === query.service)) &&
      [
        r.contractNumber,
        r.customerName,
        r.salesCounter,
        r.assignee ?? '',
        ...r.passengerNames,
        r.destination ?? '',
        r.hotelName ?? '',
        r.carrierName ?? '',
        r.mealServiceName ?? '',
        r.hotelNotes ?? '',
        ...(r.serviceTitles ?? []),
      ].some((v) => v.toLocaleLowerCase('fa').includes(search)),
  );
  filtered.sort((a, b) => {
    const order =
      query.sort === 'priority'
        ? priority[b.priority] - priority[a.priority]
        : query.sort === 'newest'
          ? Date.parse(b.receivedAt ?? b.createdAt) -
            Date.parse(a.receivedAt ?? a.createdAt)
          : (a.deadline ? Date.parse(a.deadline) : Number.MAX_SAFE_INTEGER) -
            (b.deadline ? Date.parse(b.deadline) : Number.MAX_SAFE_INTEGER);
    return order || a.id.localeCompare(b.id);
  });
  const pageSize = Number.isFinite(query.pageSize)
    ? Math.max(1, Math.min(100, Math.trunc(query.pageSize)))
    : 10;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Number.isFinite(query.page)
    ? Math.max(1, Math.min(pages, Math.trunc(query.page)))
    : 1;
  return {
    dateError,
    filteredRows: filtered,
    rows: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pages,
  };
}
export function dashboard(rows: readonly RequestView[], now: string) {
  const timestamp = Date.parse(now);
  const today = now.slice(0, 10);
  const issued = new Set(
    rows.flatMap((r) =>
      r.issues
        .filter((i) => i.issuedAt.slice(0, 10) === today)
        .map((i) => i.id),
    ),
  );
  return {
    counts: Object.fromEntries(
      Object.keys(statusLabels).map((status) => [
        status,
        rows.filter((r) => r.status === status).length,
      ]),
    ) as Record<QueueStatus, number>,
    nearSla: rows.filter(
      (r) =>
        !['COMPLETED', 'CANCELLED'].includes(r.status) &&
        (r.status === 'ERROR' ||
          (r.deadline !== null &&
            Date.parse(r.deadline) <= timestamp + 60 * 60 * 1000)),
    ).length,
    issuedToday: issued.size,
  };
}
export const messages: Record<ViewState, { title: string; body: string }> = {
  LOADING: { title: 'در حال دریافت درخواست‌ها', body: 'لطفاً کمی صبر کنید.' },
  EMPTY: {
    title: 'درخواستی وجود ندارد',
    body: 'درخواست‌های تأییدشده فروش پس از دریافت در این بخش قرار می‌گیرند.',
  },
  ERROR: {
    title: 'دریافت اطلاعات انجام نشد',
    body: 'اتصال را بررسی و دوباره تلاش کنید.',
  },
  UNAUTHORIZED: {
    title: 'ورود به حساب لازم است',
    body: 'برای مشاهده درخواست‌ها وارد حساب شوید.',
  },
  FORBIDDEN: {
    title: 'دسترسی مجاز نیست',
    body: 'مجوز مشاهده رزرواسیون برای این حساب یا شعبه فعال نیست.',
  },
  CONFLICT: {
    title: 'اطلاعات تغییر کرده است',
    body: 'نسخه تازه درخواست را دریافت و دوباره بررسی کنید.',
  },
  SUCCESS: {
    title: 'اطلاعات دریافت شد',
    body: 'درخواست‌ها در محدوده شعبه مجاز نمایش داده می‌شوند.',
  },
  NOT_CONFIGURED: {
    title: 'در انتظار اتصال',
    body: 'اتصال این بخش هنوز آماده نیست؛ صدور و ارسال فعال نشده است.',
  },
};

/** Authorized read projections only. No provider payload, identity number or download URL. */
export interface OperationView {
  id: string;
  requestId: string;
  section: Exclude<Section, 'dashboard' | 'inbox' | 'timeline'>;
  title: string;
  statusLabel: string;
  fields: readonly { label: string; value: string }[];
}
export interface TimelineView {
  id: string;
  requestId: string;
  actorLabel: string;
  actionLabel: string;
  occurredAt: string;
  outcome: 'ALLOWED' | 'DENIED';
}

export const statusTones: Record<
  QueueStatus,
  'pink' | 'lightGray' | 'darkGray' | 'red' | 'neutral'
> = {
  NEW: 'pink',
  WAITING_SUPPLIER: 'lightGray',
  SUPPLIER_CONFIRMED: 'lightGray',
  VOUCHER_ISSUED: 'darkGray',
  CANCELLED: 'red',
  ACTION_REQUIRED: 'neutral',
  WAITING_FINANCE: 'neutral',
  READY_FOR_DELIVERY: 'neutral',
  ERROR: 'neutral',
  COMPLETED: 'neutral',
};
export const workflowLegend: QueueStatus[] = [
  'NEW',
  'WAITING_SUPPLIER',
  'VOUCHER_ISSUED',
  'CANCELLED',
];
const civilDate = /^\d{4}-\d{2}-\d{2}$/;
export function isCivilDate(value: string): boolean {
  if (!civilDate.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
  );
}
/** DatePicker stores Gregorian civil days. Instant boundaries are displayed in Tehran. */
export function reservationDay(value: string | undefined): string | null {
  if (!value) return null;
  if (isCivilDate(value)) return value;
  if (
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function validateDateRange(from: string, to: string): string | null {
  if ((from && !isCivilDate(from)) || (to && !isCivilDate(to)))
    return 'تاریخ واردشده معتبر نیست.';
  if (from && to && from > to)
    return 'تاریخ شروع باید قبل از تاریخ پایان یا برابر آن باشد.';
  return null;
}
function matchesDateRange(row: RequestView, query: Query): boolean {
  if (!query.fromDate && !query.toDate) return true;
  const day = reservationDay(row[query.dateBasis]);
  return (
    day !== null &&
    (!query.fromDate || day >= query.fromDate) &&
    (!query.toDate || day <= query.toDate)
  );
}
