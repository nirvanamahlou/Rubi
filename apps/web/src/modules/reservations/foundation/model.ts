export const sections = [
  ['dashboard', 'داشبورد'],
  ['inbox', 'صندوق درخواست‌ها'],
  ['tickets', 'صدور بلیت'],
  ['hotels', 'رزرو هتل'],
  ['vouchers', 'واچر'],
  ['insurance', 'بیمه سامان'],
  ['manifests', 'Manifest'],
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
  | 'COMPLETED';
export const statusLabels: Record<QueueStatus, string> = {
  NEW: 'درخواست جدید',
  ACTION_REQUIRED: 'در انتظار اقدام',
  WAITING_SUPPLIER: 'در انتظار کارگزار',
  WAITING_FINANCE: 'در انتظار تأیید مالی',
  READY_FOR_DELIVERY: 'آماده تحویل',
  ERROR: 'خطادار',
  COMPLETED: 'تکمیل‌شده',
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
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  deadline: string;
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
}
export const defaultQuery: Query = {
  search: '',
  status: 'ALL',
  service: 'ALL',
  sort: 'deadline',
  page: 1,
  pageSize: 10,
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
  const priority = { NORMAL: 0, HIGH: 1, URGENT: 2 };
  const filtered = rows.filter(
    (r) =>
      (query.status === 'ALL' || r.status === query.status) &&
      (query.service === 'ALL' ||
        r.services.some((s) => s === query.service)) &&
      [r.contractNumber, r.customerName, r.salesCounter, r.assignee ?? ''].some(
        (v) => v.toLocaleLowerCase('fa').includes(search),
      ),
  );
  filtered.sort((a, b) => {
    const order =
      query.sort === 'priority'
        ? priority[b.priority] - priority[a.priority]
        : query.sort === 'newest'
          ? Date.parse(b.createdAt) - Date.parse(a.createdAt)
          : Date.parse(a.deadline) - Date.parse(b.deadline);
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
        r.status !== 'COMPLETED' &&
        (r.status === 'ERROR' ||
          Date.parse(r.deadline) <= timestamp + 60 * 60 * 1000),
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
