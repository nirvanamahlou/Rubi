'use client';

import { useState } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import {
  accessibleRows,
  dashboard,
  defaultQuery,
  messages,
  queryRows,
  sections,
  serviceLabels,
  statusLabels,
  statusTones,
  workflowLegend,
  type Query,
  type RequestView,
  type Section,
  type ViewAccess,
  type ViewState,
  type OperationView,
  type TimelineView,
} from './model';
import styles from './workspace.module.css';

const noAccess: ViewAccess = {
  authenticated: false,
  permissions: [],
  branchIds: [],
};
const operationContent: Record<
  Exclude<Section, 'dashboard' | 'inbox' | 'timeline'>,
  { title: string; fields: string[]; action: string; note: string }
> = {
  tickets: {
    title: 'صدور بلیت',
    fields: [
      'مسافر تخصیص‌یافته',
      'خدمت قرارداد',
      'مسیر سفر',
      'نوع وسیله',
      'ظرفیت شرکت',
      'کد داخلی صدور',
    ],
    action: 'صدور بلیت',
    note: 'صدور بلیت پس از بررسی اطلاعات مسافر و تأیید تخصیص ظرفیت انجام می‌شود.',
  },
  hotels: {
    title: 'فرم رزرو هتل',
    fields: [
      'هتل',
      'کارگزار',
      'ورود و خروج',
      'نوع و تعداد اتاق',
      'فهرست اتاق‌بندی',
      'درخواست مسافر',
      'لیدر',
      'متن تابلو',
    ],
    action: 'ارسال به کارگزار',
    note: 'اتاق‌بندی از قرارداد فروش دریافت می‌شود. پاسخ کارگزار در همین پرونده ثبت خواهد شد.',
  },
  vouchers: {
    title: 'واچر هتل',
    fields: [
      'رزرو تأییدشده',
      'شماره تأیید کارگزار',
      'شرکت صادرکننده',
      'نسخه سربرگ',
      'وضعیت تحویل',
    ],
    action: 'صدور واچر',
    note: 'واچر فقط پس از تأیید کارگزار صادر می‌شود؛ تحویل به فروش یا مسافر نیازمند تأیید مالی است.',
  },
  insurance: {
    title: 'بیمه سامان',
    fields: [
      'مسافر',
      'کشور مقصد',
      'بازه سفر',
      'طرح بیمه',
      'وضعیت درخواست',
      'شماره بیمه‌نامه',
    ],
    action: 'صدور بیمه',
    note: 'اتصال بیمه سامان آماده نیست. هیچ درخواست یا بیمه‌نامه‌ای ایجاد نشده است.',
  },
  manifests: {
    title: 'Manifest ظرفیت شرکت',
    fields: [
      'مسیر',
      'تاریخ حرکت',
      'شماره پرواز',
      'شرکت صادرکننده',
      'نسخه قالب ایرلاین',
      'مسافران',
      'زمان ارسال',
    ],
    action: 'آماده‌سازی Manifest',
    note: 'فقط ظرفیت‌ها و تورهای متعلق به شرکت؛ خروجی نهایی پس از اتصال تولید و آرشیو فایل فعال می‌شود.',
  },
  costs: {
    title: 'پیشنهاد هزینه خرید',
    fields: [
      'خدمت قرارداد',
      'تأمین‌کننده',
      'قیمت خرید اولیه',
      'تخفیف کارگزار',
      'هزینه جانبی',
      'قیمت خرید خالص',
      'ارز',
      'نرخ ارز مرجع',
    ],
    action: 'ثبت پیشنهاد هزینه',
    note: 'قیمت خالص برابر خرید اولیه منهای تخفیف، به‌علاوه هزینه جانبی است. ثبت حسابداری در مالی انجام می‌شود.',
  },
};
export interface ReservationWorkspaceProps {
  state?: ViewState;
  rows?: readonly RequestView[];
  operations?: readonly OperationView[];
  timeline?: readonly TimelineView[];
  access?: ViewAccess;
  now?: string;
  initialSection?: Section;
  /** Preview reveals layout only. It never grants access to rows or enables mutation. */
  preview?: boolean;
  newRequestCount?: number;
  onDismissNewRequests?: () => void;
}
/** Mount after the Sales route handoff. No API calls, credentials, local storage or mock records. */
export function ReservationOperationsWorkspace({
  state = 'NOT_CONFIGURED',
  rows = [],
  operations = [],
  timeline = [],
  access = noAccess,
  now = '1970-01-01T00:00:00.000Z',
  initialSection = 'dashboard',
  preview = false,
  newRequestCount = 0,
  onDismissNewRequests,
}: ReservationWorkspaceProps) {
  const [section, setSection] = useState<Section>(initialSection);
  const [query, setQuery] = useState<Query>(defaultQuery);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const effectiveState = preview
    ? 'NOT_CONFIGURED'
    : state === 'LOADING' || state === 'NOT_CONFIGURED'
      ? state
      : !access.authenticated
        ? 'UNAUTHORIZED'
        : !access.permissions.includes('reservations.read')
          ? 'FORBIDDEN'
          : state;
  const visibleRows =
    effectiveState === 'SUCCESS' ? accessibleRows(rows, access) : [];
  const result = queryRows(visibleRows, query);
  const metrics = dashboard(visibleRows, now);
  const selected = visibleRows.find((r) => r.id === selectedId);
  const available = effectiveState === 'SUCCESS';
  const message = messages[effectiveState];
  const visibleOperations = operations.filter(
    (op) =>
      op.section === section &&
      visibleRows.some((row) => row.id === op.requestId) &&
      (!selected || op.requestId === selected.id),
  );
  const visibleTimeline = access.permissions.includes('reservations.audit.read')
    ? timeline.filter(
        (event) =>
          visibleRows.some((row) => row.id === event.requestId) &&
          (!selected || event.requestId === selected.id),
      )
    : [];
  function changeQuery(patch: Partial<Query>) {
    setQuery((current) => ({ ...current, ...patch, page: 1 }));
  }
  return (
    <main
      dir="rtl"
      className={styles.workspace}
      aria-label="رزرواسیون و عملیات سفر"
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>عملیات سفر</p>
          <h1>رزرواسیون</h1>
          <p>از دریافت درخواست تا آماده‌سازی مدارک سفر</p>
        </div>
        <span className={styles.badge}>
          {preview
            ? 'پیش‌نمایش ساختار · بدون داده واقعی'
            : available
              ? 'صف درخواست‌ها'
              : message.title}
        </span>
      </header>
      <nav className={styles.tabs} aria-label="بخش‌های رزرواسیون">
        {sections.map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-current={section === key ? 'page' : undefined}
            onClick={() => setSection(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {!available && (
        <section
          className={styles.notice}
          role={
            ['ERROR', 'FORBIDDEN', 'CONFLICT'].includes(effectiveState)
              ? 'alert'
              : 'status'
          }
          aria-live="polite"
        >
          <strong>{message.title}</strong>
          <p>{message.body}</p>
          {effectiveState === 'UNAUTHORIZED' && (
            <a href="/login">ورود به حساب</a>
          )}
        </section>
      )}
      {available && newRequestCount > 0 && (
        <aside
          className={styles.newRequests}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div>
            <strong>
              {newRequestCount.toLocaleString('fa-IR')} درخواست جدید به
              رزرواسیون رسید
            </strong>
            <p>درخواست‌ها به صف اضافه شدند؛ فیلتر فعلی شما حفظ شده است.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              changeQuery({ ...defaultQuery, status: 'NEW', sort: 'newest' });
              setSection('inbox');
              onDismissNewRequests?.();
            }}
          >
            مشاهده درخواست‌های جدید
          </button>
          <button
            type="button"
            onClick={() => onDismissNewRequests?.()}
            aria-label="بستن اعلان درخواست‌های جدید"
          >
            بستن
          </button>
        </aside>
      )}
      {section === 'dashboard' && (
        <>
          <section className={styles.metrics} aria-label="خلاصه رزرواسیون">
            {(Object.keys(statusLabels) as (keyof typeof statusLabels)[])
              .filter(
                (s) =>
                  ![
                    'COMPLETED',
                    'CANCELLED',
                    'VOUCHER_ISSUED',
                    'SUPPLIER_CONFIRMED',
                  ].includes(s),
              )
              .map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    changeQuery({ status });
                    setSection('inbox');
                  }}
                >
                  <span>{statusLabels[status]}</span>
                  <strong>
                    {available
                      ? metrics.counts[status].toLocaleString('fa-IR')
                      : '—'}
                  </strong>
                  <small>مشاهده درخواست‌ها ←</small>
                </button>
              ))}
            <div>
              <span>خطادار یا نزدیک مهلت</span>
              <strong>
                {available ? metrics.nearSla.toLocaleString('fa-IR') : '—'}
              </strong>
            </div>
            <div>
              <span>صدور امروز</span>
              <strong>
                {available ? metrics.issuedToday.toLocaleString('fa-IR') : '—'}
              </strong>
              <small>بر مبنای روز UTC</small>
            </div>
          </section>
          <section className={styles.panel}>
            <h2>خدمات سفر</h2>
            <div className={styles.serviceGrid}>
              {Object.entries(serviceLabels).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    changeQuery({ service: key });
                    setSection('inbox');
                  }}
                >
                  {label}
                  <strong>
                    {available
                      ? visibleRows
                          .filter((r) => r.services.some((s) => s === key))
                          .length.toLocaleString('fa-IR')
                      : '—'}
                  </strong>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
      {section === 'inbox' && (
        <section className={styles.panel}>
          <div className={styles.panelTitle}>
            <h2>صندوق درخواست‌ها</h2>
            <span>
              {available
                ? `${result.total.toLocaleString('fa-IR')} درخواست`
                : 'در انتظار دریافت از فروش'}
            </span>
          </div>
          <div className={styles.legend} aria-label="راهنمای رنگ و فیلتر وضعیت">
            {workflowLegend.map((status) => (
              <button
                type="button"
                key={status}
                data-tone={statusTones[status]}
                aria-pressed={query.status === status}
                onClick={() =>
                  changeQuery({
                    status: query.status === status ? 'ALL' : status,
                  })
                }
              >
                <i aria-hidden="true" />
                {statusLabels[status]}
              </button>
            ))}
          </div>
          <div className={styles.filters}>
            <label>
              جست‌وجو
              <input
                value={query.search}
                maxLength={100}
                placeholder="شماره قرارداد، مسافر، هتل یا مسیر"
                onChange={(e) => changeQuery({ search: e.target.value })}
              />
            </label>
            <label>
              وضعیت
              <select
                value={query.status}
                onChange={(e) =>
                  changeQuery({ status: e.target.value as Query['status'] })
                }
              >
                <option value="ALL">همه وضعیت‌ها</option>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              خدمت
              <select
                value={query.service}
                onChange={(e) => changeQuery({ service: e.target.value })}
              >
                <option value="ALL">همه خدمات</option>
                {Object.entries(serviceLabels).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              مرتب‌سازی
              <select
                value={query.sort}
                onChange={(e) =>
                  changeQuery({ sort: e.target.value as Query['sort'] })
                }
              >
                <option value="deadline">نزدیک‌ترین مهلت</option>
                <option value="newest">جدیدترین درخواست</option>
                <option value="priority">بیشترین اولویت</option>
              </select>
            </label>
          </div>
          <div className={styles.dateFilters}>
            <label>
              مبنای تاریخ
              <select
                value={query.dateBasis}
                onChange={(e) =>
                  changeQuery({
                    dateBasis: e.target.value as Query['dateBasis'],
                  })
                }
              >
                <option value="createdAt">تاریخ قرارداد</option>
                <option value="receivedAt">ورود به رزرواسیون</option>
                <option value="travelDate">تاریخ سفر</option>
              </select>
            </label>
            <div>
              <label htmlFor="reservation-from">از تاریخ</label>
              <DatePicker
                id="reservation-from"
                value={query.fromDate}
                onChange={(fromDate) => changeQuery({ fromDate })}
                aria-invalid={Boolean(result.dateError)}
                aria-describedby="reservation-date-help"
              />
            </div>
            <div>
              <label htmlFor="reservation-to">تا تاریخ</label>
              <DatePicker
                id="reservation-to"
                value={query.toDate}
                onChange={(toDate) => changeQuery({ toDate })}
                aria-invalid={Boolean(result.dateError)}
                aria-describedby="reservation-date-help"
              />
            </div>
            <button type="button" onClick={() => setQuery({ ...defaultQuery })}>
              پاک‌کردن فیلترها
            </button>
          </div>
          <p id="reservation-date-help" className={styles.filterHelp}>
            {result.dateError ??
              'بازه شامل تمام روز شروع و پایان است؛ ساعت‌ها بر مبنای تهران محاسبه می‌شوند.'}
          </p>
          {result.dateError && <p role="alert">{result.dateError}</p>}
          {result.rows.length === 0 ? (
            <p className={styles.empty}>
              {available
                ? 'درخواستی مطابق فیلترها پیدا نشد.'
                : 'هنوز درخواستی دریافت نشده است.'}
            </p>
          ) : (
            <ul className={styles.requests}>
              {result.rows.map((row) => (
                <li
                  key={row.id}
                  data-tone={statusTones[row.status]}
                  data-selected={selectedId === row.id}
                >
                  <button type="button" onClick={() => setSelectedId(row.id)}>
                    <strong>{row.contractNumber}</strong>
                    <span>
                      {row.customerName !== '—'
                        ? row.customerName
                        : row.passengerNames.slice(0, 2).join('، ') ||
                          'نام مشتری دریافت نشده'}
                    </span>
                    {row.hotelName && <small>{row.hotelName}</small>}
                  </button>
                  <span className={styles.statusLabel}>
                    {statusLabels[row.status]}
                  </span>
                  <span>
                    {row.services.map((s) => serviceLabels[s]).join('، ')}
                  </span>
                  <span>{row.assignee ?? 'تخصیص‌نیافته'}</span>
                  <span>
                    <small>مهلت اقدام</small>
                    {row.deadline ? (
                      <time dateTime={row.deadline}>
                        {new Date(row.deadline).toLocaleString('fa-IR', {
                          timeZone: 'Asia/Tehran',
                        })}
                      </time>
                    ) : (
                      'تعیین نشده'
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className={styles.pagination}>
            <button
              type="button"
              disabled={result.page <= 1}
              onClick={() => setQuery((q) => ({ ...q, page: result.page - 1 }))}
            >
              قبلی
            </button>
            <span>
              صفحه {result.page.toLocaleString('fa-IR')} از{' '}
              {result.pages.toLocaleString('fa-IR')}
            </span>
            <button
              type="button"
              disabled={result.page >= result.pages}
              onClick={() => setQuery((q) => ({ ...q, page: result.page + 1 }))}
            >
              بعدی
            </button>
          </div>
        </section>
      )}
      {selected && (
        <section className={styles.panel} aria-label="جزئیات درخواست">
          <div className={styles.panelTitle}>
            <h2>قرارداد {selected.contractNumber}</h2>
            <button type="button" onClick={() => setSelectedId(null)}>
              بستن جزئیات
            </button>
          </div>
          <dl className={styles.details}>
            {Object.entries({
              مشتری: selected.customerName,
              'کانتر فروش': selected.salesCounter,
              'شرکت صادرکننده': selected.issuerName,
              شعبه: selected.branchName,
              مسافران: selected.passengerNames.join('، '),
              'مسئول رزرواسیون': selected.assignee ?? 'تخصیص‌نیافته',
              اولویت: {
                NORMAL: 'عادی',
                HIGH: 'بالا',
                URGENT: 'فوری',
                UNSPECIFIED: 'تعیین نشده',
              }[selected.priority],
            }).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p>اطلاعات قرارداد و تخصیص مسافران فقط در فروش اصلاح می‌شود.</p>
          <button type="button" disabled>
            بازگرداندن نقص به فروش · در انتظار اتصال
          </button>
        </section>
      )}
      {section !== 'dashboard' &&
        section !== 'inbox' &&
        section !== 'timeline' && (
          <section className={styles.panel}>
            <div className={styles.panelTitle}>
              <h2>{operationContent[section].title}</h2>
              <span className={styles.badge}>در انتظار اتصال</span>
            </div>
            <p>{operationContent[section].note}</p>
            {visibleOperations.map((operation) => (
              <article key={operation.id} aria-label={operation.title}>
                <div className={styles.panelTitle}>
                  <h3>{operation.title}</h3>
                  <span>{operation.statusLabel}</span>
                </div>
                <dl className={styles.details}>
                  {operation.fields.map((field) => (
                    <div key={field.label}>
                      <dt>{field.label}</dt>
                      <dd>{field.value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
            <dl className={styles.details}>
              {operationContent[section].fields.map((label) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>—</dd>
                </div>
              ))}
            </dl>
            <div className={styles.actions}>
              <button type="button" disabled>
                {operationContent[section].action}
              </button>
              {section === 'tickets' && (
                <>
                  <label>
                    دلیل توقف
                    <input placeholder="دلیل توقف بلیت" disabled />
                  </label>
                  <button type="button" disabled>
                    توقف صدور
                  </button>
                </>
              )}
              {['tickets', 'vouchers', 'insurance'].includes(section) && (
                <button type="button" disabled>
                  تحویل مدارک · نیازمند تأیید مالی
                </button>
              )}
            </div>
          </section>
        )}
      {section === 'timeline' && (
        <section className={styles.panel}>
          <h2>رویدادهای درخواست</h2>
          {visibleTimeline.length > 0 && (
            <ol>
              {visibleTimeline.map((event) => (
                <li key={event.id}>
                  <strong>{event.actionLabel}</strong> · {event.actorLabel} ·{' '}
                  {event.outcome === 'ALLOWED' ? 'انجام‌شده' : 'ردشده'}
                  <time dateTime={event.occurredAt}>
                    {' '}
                    · {new Date(event.occurredAt).toLocaleString('fa-IR')}
                  </time>
                </li>
              ))}
            </ol>
          )}
          <p className={styles.empty}>
            {!preview && !access.permissions.includes('reservations.audit.read')
              ? 'مجوز مشاهده رویدادها لازم است.'
              : visibleTimeline.length
                ? ''
                : 'تاریخچه عملیات پس از اتصال نمایش داده می‌شود.'}
          </p>
        </section>
      )}
    </main>
  );
}
