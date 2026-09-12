export const CHANGE_NOTIFICATIONS_STORAGE_KEY = 'rubi.change-notifications.v1';
export const CHANGE_NOTIFICATIONS_EVENT = 'rubi:change-notifications';
export const CHANGE_NOTIFICATIONS_LIMIT = 60;

export interface ChangeNotification {
  id: string;
  title: string;
  description: string;
  href: string;
  occurredAt: string;
  readAt: string | null;
}

export interface MutationResult {
  method: string;
  requestUrl: string;
  responseOk: boolean;
}

function requestDetails(
  input: RequestInfo | URL,
  init?: RequestInit,
): { method: string; requestUrl: string } {
  const request = typeof Request !== 'undefined' && input instanceof Request;
  return {
    method: init?.method ?? (request ? input.method : 'GET'),
    requestUrl:
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
  };
}

interface NotificationArea {
  label: string;
  href: string;
}

const notificationAreas: readonly (readonly [string, NotificationArea])[] = [
  ['iam/users', { label: 'کاربران و دسترسی‌ها', href: '/users' }],
  ['iam/roles', { label: 'کاربران و دسترسی‌ها', href: '/users' }],
  ['iam/auth/sessions', { label: 'نشست‌های امنیتی', href: '/users' }],
  [
    'legal-entities',
    { label: 'شرکت‌های صادرکننده', href: '/system/legal-entities' },
  ],
  ['master-data', { label: 'اطلاعات پایه', href: '/master-data' }],
  ['customers', { label: 'مشتریان', href: '/customers' }],
  ['customer-affairs', { label: 'امور مشتریان', href: '/customer-affairs' }],
  ['sales', { label: 'فروش و قراردادها', href: '/sales' }],
  ['ticket-catalog', { label: 'مدیریت بلیط‌ها', href: '/ticket-management' }],
  ['reservations', { label: 'رزرواسیون و عملیات سفر', href: '/reservations' }],
  ['procurement', { label: 'خرید و تأمین', href: '/purchases' }],
  ['purchases', { label: 'خرید و تأمین', href: '/purchases' }],
  ['finance', { label: 'کارتابل درخواست‌های مالی', href: '/finance/requests' }],
  ['marketing', { label: 'مارکتینگ', href: '/marketing' }],
  ['b2b', { label: 'آژانس‌ها و مشتریان سازمانی', href: '/organizations' }],
  [
    'organizations',
    { label: 'آژانس‌ها و مشتریان سازمانی', href: '/organizations' },
  ],
  ['human-resources', { label: 'منابع انسانی', href: '/human-resources' }],
  ['tasks', { label: 'وظایف و اتوماسیون', href: '/tasks' }],
  ['documents', { label: 'اسناد و فایل‌ها', href: '/documents' }],
  ['integrations', { label: 'یکپارچه‌سازی‌ها', href: '/integrations' }],
  ['settings', { label: 'تنظیمات سیستم', href: '/settings' }],
];

const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ignoredPathSegments = new Set([
  'export',
  'exports',
  'preview',
  'previews',
  'search',
  'validate',
  'validation',
]);

function cleanBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function relativeApiPath(requestUrl: string, apiBaseUrl: string) {
  const base = cleanBaseUrl(apiBaseUrl);
  if (!base) return null;
  let request: URL;
  let configuredBase: URL;
  try {
    request = new URL(requestUrl, base);
    configuredBase = new URL(`${base}/`);
  } catch {
    return null;
  }
  if (request.origin !== configuredBase.origin) return null;
  const basePath = configuredBase.pathname.replace(/\/+$/, '');
  if (
    request.pathname !== basePath &&
    !request.pathname.startsWith(`${basePath}/`)
  )
    return null;
  return request.pathname.slice(basePath.length).replace(/^\/+/, '');
}

function isIgnoredMutation(path: string) {
  if (path === 'iam/auth' || path.startsWith('iam/auth/'))
    return true;
  if (
    path === 'documents' ||
    path.startsWith('documents/') ||
    path === 'notifications' ||
    path.startsWith('notifications/') ||
    path === 'hr' ||
    path.startsWith('hr/')
  )
    return true;
  return path
    .split('/')
    .some((segment) => ignoredPathSegments.has(segment.toLowerCase()));
}

function areaForPath(path: string): NotificationArea {
  return (
    notificationAreas.find(
      ([prefix]) => path === prefix || path.startsWith(`${prefix}/`),
    )?.[1] ?? { label: 'سامانه', href: '/dashboard' }
  );
}

function actionForMutation(method: string, path: string) {
  const segments = path.toLowerCase().split('/');
  if (segments.includes('archive')) return 'بایگانی';
  if (segments.includes('restore')) return 'بازیابی';
  if (segments.includes('upload')) return 'بارگذاری فایل';
  if (segments.includes('activate')) return 'فعال‌سازی';
  if (segments.includes('deactivate')) return 'غیرفعال‌سازی';
  if (segments.includes('status')) return 'تغییر وضعیت';
  if (segments.includes('switch')) return 'تغییر انتخاب فعال';
  if (segments.includes('bulk')) return 'عملیات گروهی';
  if (method === 'DELETE') return 'حذف';
  if (method === 'PATCH' || method === 'PUT') return 'ویرایش';
  return 'ثبت اطلاعات جدید';
}

export function buildChangeNotification(
  result: MutationResult,
  apiBaseUrl: string,
  options: { id: string; occurredAt: string },
): ChangeNotification | null {
  const method = result.method.toUpperCase();
  if (!result.responseOk || !mutationMethods.has(method)) return null;
  const path = relativeApiPath(result.requestUrl, apiBaseUrl);
  if (!path || isIgnoredMutation(path)) return null;
  const area = areaForPath(path);
  const action = actionForMutation(method, path);
  return {
    id: options.id,
    title: `${action} در ${area.label}`,
    description: `${action} با موفقیت ثبت شد.`,
    href: area.href,
    occurredAt: options.occurredAt,
    readAt: null,
  };
}

export function createTrackedFetch(
  originalFetch: typeof fetch,
  apiBaseUrl: string,
  onNotification: (notification: ChangeNotification) => void,
  createId: () => string,
  now: () => Date,
): typeof fetch {
  return async (...args) => {
    const response = await originalFetch(...args);
    try {
      const { method, requestUrl } = requestDetails(args[0], args[1]);
      const notification = buildChangeNotification(
        { method, requestUrl, responseOk: response.ok },
        apiBaseUrl,
        { id: createId(), occurredAt: now().toISOString() },
      );
      if (notification) onNotification(notification);
    } catch {
      // Notification bookkeeping must never change the request result.
    }
    return response;
  };
}

function isChangeNotification(value: unknown): value is ChangeNotification {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ChangeNotification>;
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.description === 'string' &&
    typeof item.href === 'string' &&
    item.href.startsWith('/') &&
    typeof item.occurredAt === 'string' &&
    Number.isFinite(Date.parse(item.occurredAt)) &&
    (item.readAt === null ||
      (typeof item.readAt === 'string' &&
        Number.isFinite(Date.parse(item.readAt))))
  );
}

export function parseChangeNotifications(value: string | null) {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isChangeNotification)
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, CHANGE_NOTIFICATIONS_LIMIT);
  } catch {
    return [];
  }
}

export function limitChangeNotifications(
  notifications: readonly ChangeNotification[],
) {
  return [...notifications]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, CHANGE_NOTIFICATIONS_LIMIT);
}
