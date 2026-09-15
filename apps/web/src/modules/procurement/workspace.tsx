'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ProcurementPermission,
  ProcurementRequestV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input, FormField, Textarea } from '@/components/ui/form-controls';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Skeleton,
} from '@/components/ui/surfaces';
import { procurementApi, commandAttempt, type Bootstrap } from './api';
import { DraftForm, selectClass } from './draft-form';
import { statusLabels } from './model';
import { OperationForm } from './operation-form';
import { ProcurementOwnerPicker } from './owner-picker';
import { ProcurementExportPanel } from './export-panel';
import {
  formatProcurementDate,
  formatProcurementRecordValue,
} from './presentation';
import { sampleRequests, type ProcurementListRow } from './sample-requests';

const groups = [
  'میزکار خرید',
  'درخواست‌های خرید',
  'تأییدهای من',
  'تأمین‌کنندگان',
  'استعلام‌ها و پیشنهادها',
  'سفارش‌های خرید',
  'دریافت، پذیرش و مغایرت',
  'فاکتورها و ارتباط مالی',
] as const;
const sectionKeys = [
  'home',
  'requests',
  'approvals',
  'suppliers',
  'quotes',
  'orders',
  'receipts',
  'invoices',
] as const;
function sectionIndex(value: string | null): number {
  const index = sectionKeys.findIndex((key) => key === value);
  return index < 0 ? 0 : index;
}
const queues = [
  ['own', 'کارهای من'],
  ['unit', 'صف واحد'],
  ['unassigned', 'بدون مسئول'],
  ['approvals', 'تأییدهای معوق'],
  ['returned', 'برگشتی‌ها'],
  ['late', 'سفارش‌های دیرکرددار'],
  ['partial', 'تحویل ناقص'],
  ['discrepant', 'فاکتور دارای مغایرت'],
  ['finance', 'منتظر مالی'],
] as const;
const kinds = [
  ['quotations', 'استعلام‌ها'],
  ['orders', 'سفارش‌ها'],
  ['receipts', 'رسید کالا'],
  ['adjustments', 'اصلاحات جبرانی'],
  ['acceptances', 'پذیرش خدمت'],
  ['discrepancies', 'مغایرت‌ها'],
  ['returns', 'مرجوعی‌ها'],
  ['invoices', 'فاکتورها'],
  ['handoffs', 'ارجاع مالی'],
  ['audit', 'تاریخچه'],
] as const;
const nextAction: Record<ProcurementRequestV1['status'], string> = {
  DRAFT: 'تکمیل و ارسال درخواست',
  SUBMITTED: 'تعیین مسئول و بررسی',
  IN_REVIEW: 'ثبت تصمیم تأییدکننده',
  CHANGES_REQUESTED: 'اصلاح و ارسال مجدد',
  APPROVED: 'دریافت پیشنهاد تأمین‌کنندگان',
  SOURCING: 'پیگیری سفارش و تحویل',
  REJECTED: 'پایان بررسی',
  CANCELLED: 'لغوشده',
  CLOSED: 'پرونده بسته است',
};
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'دریافت اطلاعات ناموفق بود.';
function Pager({
  page,
  hasMore,
  setPage,
}: {
  page: number;
  hasMore: boolean;
  setPage: (value: number) => void;
}) {
  return (
    <nav
      aria-label="صفحه‌بندی"
      className="flex items-center justify-between gap-3 pt-4"
    >
      <Button
        variant="outline"
        disabled={page === 1}
        onClick={() => setPage(page - 1)}
      >
        قبلی
      </Button>
      <span className="text-sm">صفحه {page.toLocaleString('fa-IR')}</span>
      <Button
        variant="outline"
        disabled={!hasMore}
        onClick={() => setPage(page + 1)}
      >
        بعدی
      </Button>
    </nav>
  );
}
export function ProcurementWorkspace() {
  const bootstrap = useQuery({
    queryKey: ['procurement', 'bootstrap'],
    queryFn: procurementApi.bootstrap,
    retry: false,
  });
  return (
    <section
      dir="rtl"
      className="space-y-6 bg-[#f3f6fc] font-sans text-[#183968]"
    >
      {bootstrap.isPending ? (
        <div role="status" aria-label="در حال دریافت دسترسی‌ها">
          <Skeleton className="h-72" />
        </div>
      ) : bootstrap.isError ? (
        <Alert
          tone="error"
          title="دسترسی به خرید برقرار نشد"
          description={errorText(bootstrap.error)}
        >
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void bootstrap.refetch()}
          >
            تلاش دوباره
          </Button>
        </Alert>
      ) : (
        <Suspense fallback={<Skeleton className="h-72" />}>
          <WorkspaceContent bootstrap={bootstrap.data} />
        </Suspense>
      )}
    </section>
  );
}
function WorkspaceContent({ bootstrap }: { bootstrap: Bootstrap }) {
  const params = useSearchParams();
  const requestFromUrl = params.get('request');
  return (
    <WorkspaceState
      bootstrap={bootstrap}
      initialRequestId={requestFromUrl}
      initialSection={params.get('section')}
    />
  );
}
function WorkspaceState({
  bootstrap,
  initialRequestId,
  initialSection,
}: {
  bootstrap: Bootstrap;
  initialRequestId: string | null;
  initialSection: string | null;
}) {
  const client = useQueryClient();
  const [group, setGroup] = useState(() => sectionIndex(initialSection));
  const [queue, setQueue] = useState('own');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [querySearch, setQuerySearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(initialRequestId);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const can = (permission: ProcurementPermission) =>
    bootstrap.permissions.includes(permission);
  useEffect(() => {
    const restoreAddress = () => {
      const params = new URLSearchParams(window.location.search);
      setGroup(sectionIndex(params.get('section')));
      setSelectedId(params.get('request'));
      setCreating(false);
      setEditing(false);
      setPage(1);
    };
    window.addEventListener('popstate', restoreAddress);
    return () => window.removeEventListener('popstate', restoreAddress);
  }, []);
  function updateAddress(section: number, requestId: string | null) {
    const url = new URL(window.location.href);
    url.searchParams.set('section', sectionKeys[section] ?? 'home');
    if (requestId) url.searchParams.set('request', requestId);
    else url.searchParams.delete('request');
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (
      next !==
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    )
      window.history.pushState(window.history.state, '', next);
  }
  function navigateGroup(index: number) {
    setGroup(index);
    setPage(1);
    setSelectedId(null);
    setCreating(false);
    setEditing(false);
    updateAddress(index, null);
  }
  function openRequest(id: string) {
    setSelectedId(id);
    updateAddress(group, id);
  }
  function closeRequest() {
    setSelectedId(null);
    updateAddress(group, null);
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuerySearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const queryQueue = group === 2 ? 'approvals' : group === 0 ? queue : '';
  const list = useQuery({
    queryKey: [
      'procurement',
      'requests',
      page,
      querySearch,
      status,
      queryQueue,
    ],
    queryFn: () =>
      procurementApi.list(
        new URLSearchParams({
          page: String(page),
          search: querySearch,
          status,
          queue: queryQueue,
        }),
      ),
    enabled: group !== 3,
    retry: false,
  });
  const suppliers = useQuery({
    queryKey: ['procurement', 'suppliers', page, querySearch],
    queryFn: () => procurementApi.suppliers(page, querySearch),
    enabled: group === 3,
    retry: false,
  });
  const detail = useQuery({
    queryKey: ['procurement', 'request', selectedId],
    queryFn: () => procurementApi.get(selectedId!),
    enabled: !!selectedId,
    retry: false,
  });
  const showSamples =
    (group === 0 || group === 1) &&
    page === 1 &&
    !status &&
    !search &&
    !querySearch &&
    (group !== 0 || queue === 'own') &&
    list.isSuccess &&
    list.data.items.length === 0;
  const rows: ProcurementListRow[] = showSamples
    ? sampleRequests
    : (list.data?.items ?? []);
  const relatedStart =
    group === 1 || group === 2
      ? 1
      : group === 3 || group === 4
        ? 3
        : group === 5 || group === 6
          ? 5
          : null;
  function saved(request: ProcurementRequestV1) {
    setCreating(false);
    setEditing(false);
    openRequest(request.id);
    client.setQueryData(['procurement', 'request', request.id], request);
    void client.invalidateQueries({ queryKey: ['procurement', 'requests'] });
    void client.invalidateQueries({
      queryKey: ['procurement', 'operation-options'],
    });
  }
  if (creating || (editing && detail.data))
    return (
      <div
        className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 sm:p-8"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setCreating(false);
            setEditing(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setCreating(false);
            setEditing(false);
          }
        }}
        role="presentation"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="فرم درخواست خرید"
          className="mx-auto max-w-5xl"
        >
          <DraftForm
            key={creating ? 'new' : detail.data!.id}
            bootstrap={bootstrap}
            {...(!creating && detail.data ? { request: detail.data } : {})}
            onSaved={saved}
            onClose={() => {
              setCreating(false);
              setEditing(false);
            }}
          />
        </div>
      </div>
    );
  return (
    <>
      {bootstrap.policy === 'POLICY_NOT_CONFIGURED' && (
        <Alert
          tone="warning"
          title="سیاست تأیید خرید هنوز تنظیم نشده است"
          description="پیش‌نویس قابل ثبت است. ارسال و مراحل وابسته به سیاست، تا تنظیم مسیر تأیید معتبر مسدود می‌ماند."
        />
      )}
      {selectedId ? (
        <div className="space-y-4">
          <Button variant="outline" onClick={closeRequest}>
            بازگشت به فهرست
          </Button>
          {detail.isPending ? (
            <Skeleton className="h-72" />
          ) : detail.isError ? (
            <Alert
              tone="error"
              title="پرونده دریافت نشد"
              description={errorText(detail.error)}
            >
              <Button variant="outline" onClick={() => void detail.refetch()}>
                تلاش دوباره
              </Button>
            </Alert>
          ) : (
            detail.data && (
              <RequestDetail
                key={detail.data.id}
                request={detail.data}
                bootstrap={bootstrap}
                onEdit={() => setEditing(true)}
                onChanged={saved}
                initialKind={
                  group === 4
                    ? 'quotations'
                    : group === 5
                      ? 'orders'
                      : group === 6
                        ? 'receipts'
                        : group === 7
                          ? 'invoices'
                          : 'audit'
                }
              />
            )
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3 py-2">
            <div>
              <p className="mb-2 text-xs text-[#7789a6]">
                روبی /{' '}
                {group === 0 ? (
                  'خرید و تأمین'
                ) : (
                  <button
                    className="hover:text-[#1657b5] hover:underline"
                    onClick={() => navigateGroup(0)}
                  >
                    خرید و تأمین
                  </button>
                )}{' '}
                / {groups[group]}
              </p>
              <h1 className="text-2xl font-black tracking-tight text-[#113975] sm:text-3xl">
                {groups[group]}
              </h1>
              <p className="mt-2 text-sm text-[#7789a6]">
                {group === 0
                  ? 'درخواست، تأمین و تحویل را از یک مسیر پیگیری کنید.'
                  : 'پرونده‌ها و عملیات این بخش را پیگیری کنید.'}
              </p>
            </div>
            {can('procurement.request.create') && (
              <Button
                className="bg-[#1973df] text-white hover:bg-[#1657b5]"
                onClick={() => setCreating(true)}
              >
                درخواست خرید جدید
              </Button>
            )}
          </div>
          {group === 0 && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    [
                      'در انتظار بررسی',
                      list.isPending
                        ? null
                        : rows.filter(
                            (item) =>
                              item.status === 'SUBMITTED' ||
                              item.status === 'IN_REVIEW',
                          ).length,
                    ],
                    [
                      'در مسیر تأمین',
                      list.isPending
                        ? null
                        : rows.filter(
                            (item) =>
                              item.status === 'APPROVED' ||
                              item.status === 'SOURCING',
                          ).length,
                    ],
                    [
                      'نیازمند اصلاح',
                      list.isPending
                        ? null
                        : rows.filter(
                            (item) => item.status === 'CHANGES_REQUESTED',
                          ).length,
                    ],
                  ] as const
                ).map(([label, count]) => (
                  <div
                    key={label}
                    className="rounded-[14px] border border-[#dfe8f4] bg-white p-5 shadow-sm"
                  >
                    <p className="text-sm text-[#7789a6]">{label}</p>
                    <p className="mt-4 text-2xl font-black text-[#113975]">
                      {count === null ? '—' : count.toLocaleString('fa-IR')}
                    </p>
                    <p className="mt-2 text-xs text-[#7789a6]">
                      {showSamples
                        ? 'نمونهٔ آزمایشی، بدون ثبت در سامانه'
                        : 'در صفحهٔ فعلی صف انتخاب‌شده'}
                    </p>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {(
                  [
                    [
                      1,
                      'درخواست و تأیید',
                      'ثبت نیاز و تصمیم‌گیری درباره درخواست‌ها',
                      'bg-[#eff5ff]',
                    ],
                    [
                      3,
                      'تأمین‌کنندگان و استعلام',
                      'مرجع تأمین‌کنندگان و پیشنهادهای مرتبط',
                      'bg-[#f6efff]',
                    ],
                    [
                      5,
                      'سفارش و تحویل',
                      'سفارش، رسید، پذیرش و مغایرت',
                      'bg-[#eafbf8]',
                    ],
                    [
                      7,
                      'فاکتور و مالی',
                      'تطبیق فاکتور و پیگیری ارجاع مالی',
                      'bg-[#fff6e9]',
                    ],
                  ] as const
                ).map(([index, label, description, tint]) => (
                  <div
                    key={label}
                    className={`rounded-[14px] border border-[#dfe8f4] p-5 text-right shadow-sm ${tint}`}
                  >
                    <button
                      onClick={() => navigateGroup(index)}
                      className="font-bold text-[#113975] hover:text-[#1657b5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1973df]"
                    >
                      {label}
                    </button>
                    <p className="mt-2 text-sm text-[#7789a6]">{description}</p>
                    <div className="mt-5 flex flex-wrap gap-3 border-t border-[#dfe8f4] pt-3 text-xs font-semibold text-[#1657b5]">
                      <button
                        onClick={() => navigateGroup(index)}
                        className="hover:underline"
                      >
                        ورود به بخش ←
                      </button>
                      {index !== 7 && (
                        <button
                          onClick={() => navigateGroup(index + 1)}
                          className="hover:underline"
                        >
                          {groups[index + 1]} ←
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {relatedStart !== null && (
            <div
              className="flex flex-wrap gap-2 text-sm"
              aria-label="بخش‌های مرتبط"
            >
              {[relatedStart, relatedStart + 1].map((index) => (
                <button
                  key={sectionKeys[index]}
                  aria-current={group === index ? 'page' : undefined}
                  onClick={() => navigateGroup(index)}
                  className={`rounded-lg border border-[#dfe8f4] px-3 py-2 ${group === index ? 'bg-[#1657b5] text-white' : 'bg-white hover:bg-[#edf4ff]'}`}
                >
                  {groups[index]}
                </button>
              ))}
            </div>
          )}
          {group === 0 && (
            <div
              className="flex flex-wrap gap-2 rounded-[14px] border border-[#dfe8f4] bg-white p-4"
              aria-label="صف کاری"
            >
              {queues.map(([value, label]) => (
                <Button
                  key={value}
                  variant={queue === value ? 'secondary' : 'outline'}
                  aria-pressed={queue === value}
                  onClick={() => {
                    setQueue(value);
                    setPage(1);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
          )}
          {group >= 4 && group <= 7 && (
            <Alert
              title="نمایش براساس پرونده خرید"
              description="پرونده را انتخاب کنید تا اسناد و عملیات مربوط به آن را ببینید."
            />
          )}
          {group === 7 && bootstrap.finance === 'NOT_CONNECTED' && (
            <Alert
              tone="warning"
              title="اتصال مالی فعال نیست"
              description="ثبت و تطبیق فاکتور در خرید انجام می‌شود. تا پذیرش قرارداد توسط مالی، ایجاد تعهد یا ثبت مالی تأیید نمی‌شود."
            />
          )}
          <Card className="grid gap-4 rounded-[14px] border-[#dfe8f4] bg-white p-4 sm:grid-cols-2">
            <FormField
              id="proc-search"
              label={
                group === 3 ? 'جست‌وجوی تأمین‌کننده' : 'جست‌وجوی شماره یا عنوان'
              }
            >
              <Input
                id="proc-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </FormField>
            {group !== 3 && (
              <FormField id="proc-status" label="وضعیت درخواست">
                <select
                  id="proc-status"
                  className={selectClass}
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">همه وضعیت‌ها</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
          </Card>
          {group === 3 ? (
            suppliers.isPending ? (
              <Skeleton className="h-64" />
            ) : suppliers.isError ? (
              <Alert
                tone="error"
                title="تأمین‌کنندگان دریافت نشدند"
                description={errorText(suppliers.error)}
              >
                <Button
                  variant="outline"
                  onClick={() => void suppliers.refetch()}
                >
                  تلاش دوباره
                </Button>
              </Alert>
            ) : (
              <>
                <Alert
                  title="اطلاعات مرجع تأمین‌کنندگان"
                  description="نام، وضعیت فعالیت و وضعیت همکاری از اطلاعات پایه دریافت می‌شود. ویرایش اطلاعات مرجع در ماژول اطلاعات پایه انجام می‌شود."
                />
                {!suppliers.data.items.length ? (
                  <EmptyState
                    title="تأمین‌کننده‌ای پیدا نشد"
                    description="فیلتر جست‌وجو یا اطلاعات پایه را بررسی کنید."
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {suppliers.data.items.map((supplier) => (
                      <Card key={supplier.id} className="space-y-3 p-5">
                        <h3 className="font-bold">{supplier.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {supplier.code}
                        </p>
                        <Badge>{supplier.isActive ? 'فعال' : 'غیرفعال'}</Badge>
                        <p className="text-sm">
                          وضعیت همکاری: {supplier.collaborationStatus}
                        </p>
                      </Card>
                    ))}
                  </div>
                )}
                <Pager
                  page={page}
                  hasMore={suppliers.data.hasMore}
                  setPage={setPage}
                />
              </>
            )
          ) : list.isPending ? (
            <Skeleton className="h-64" />
          ) : list.isError ? (
            <Alert
              tone="error"
              title="درخواست‌ها دریافت نشدند"
              description={errorText(list.error)}
            >
              <Button variant="outline" onClick={() => void list.refetch()}>
                تلاش دوباره
              </Button>
            </Alert>
          ) : (
            <>
              {showSamples && (
                <div
                  role="note"
                  className="rounded-lg border border-[#c8d9ee] bg-[#eaf4ff] px-4 py-3 text-sm text-[#183968]"
                >
                  این پرونده‌ها نمونهٔ آزمایشی برای بررسی ظاهر هستند؛ در سامانه
                  ذخیره نشده‌اند و عملیات واقعی ندارند.
                </div>
              )}
              {!rows.length ? (
                <EmptyState
                  title="درخواستی در این صف نیست"
                  description="با تغییر صف یا فیلتر دوباره بررسی کنید؛ درخواست‌های مجاز شما اینجا نمایش داده می‌شوند."
                />
              ) : (
                <div className="overflow-hidden rounded-[14px] border border-[#dfe8f4] bg-white shadow-sm">
                  <div className="border-b border-[#dfe8f4] px-5 py-4">
                    <h2 className="font-bold text-[#113975]">
                      {group === 0 ? 'پیگیری‌های من' : 'پرونده‌های درخواست'}
                    </h2>
                    <p className="mt-1 text-xs text-[#7789a6]">
                      پرونده‌های قابل مشاهده در صف و فیلتر انتخاب‌شده
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-right text-sm">
                      <thead className="bg-[#f4f8ff] text-xs text-[#536b91]">
                        <tr>
                          <th scope="col" className="px-5 py-3 font-semibold">
                            شماره / عنوان
                          </th>
                          <th scope="col" className="px-5 py-3 font-semibold">
                            مبلغ
                          </th>
                          <th scope="col" className="px-5 py-3 font-semibold">
                            وضعیت
                          </th>
                          <th scope="col" className="px-5 py-3 font-semibold">
                            اقدام بعدی
                          </th>
                          <th scope="col" className="px-5 py-3 font-semibold">
                            عملیات
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#dfe8f4]">
                        {rows.map((request) => (
                          <tr key={request.id} className="hover:bg-[#f8fbff]">
                            <td className="px-5 py-4">
                              <span className="block font-bold text-[#1657b5]">
                                {request.draft.title || 'پیش‌نویس بدون عنوان'}
                              </span>
                              <span
                                className="mt-1 block text-xs text-[#7789a6]"
                                dir="ltr"
                              >
                                {request.number}
                              </span>
                              {request.sample && (
                                <span className="mt-1 block text-xs text-[#7789a6]">
                                  نمونهٔ آزمایشی
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4" dir="ltr">
                              {request.draft.estimatedAmount ?? 'نامشخص'}{' '}
                              {request.draft.currencyCode ?? ''}
                            </td>
                            <td className="px-5 py-4">
                              <Badge>{statusLabels[request.status]}</Badge>
                            </td>
                            <td className="px-5 py-4 text-[#536b91]">
                              {nextAction[request.status]}
                            </td>
                            <td className="px-5 py-4">
                              {request.sample ? (
                                <span className="text-xs text-[#7789a6]">
                                  فقط نمایش
                                </span>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openRequest(request.id)}
                                >
                                  مشاهده
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {!showSamples && (
                <Pager
                  page={page}
                  hasMore={list.data.hasMore}
                  setPage={setPage}
                />
              )}
            </>
          )}
        </>
      )}
      {!selectedId && group !== 3 && (
        <ProcurementExportPanel
          bootstrap={bootstrap}
          kind="REQUESTS"
          query={{ status, search: querySearch, queue: queryQueue }}
        />
      )}
    </>
  );
}

function RequestDetail({
  request,
  bootstrap,
  onEdit,
  onChanged,
  initialKind,
}: {
  request: ProcurementRequestV1;
  bootstrap: Bootstrap;
  onEdit: () => void;
  onChanged: (request: ProcurementRequestV1) => void;
  initialKind: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const [reason, setReason] = useState('');
  const [owner, setOwner] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState(initialKind);
  const [page, setPage] = useState(1);
  const identity = useRef<ReturnType<typeof commandAttempt> | null>(null);
  const can = (permission: ProcurementPermission) =>
    bootstrap.permissions.includes(permission);
  const records = useQuery({
    queryKey: [
      'procurement',
      'records',
      request.id,
      request.version,
      kind,
      page,
    ],
    queryFn: () => procurementApi.records(request.id, kind, page),
    enabled: kind !== 'audit' || can('procurement.audit.read'),
    retry: false,
  });
  async function command(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    identity.current = commandAttempt(identity.current, request, body);
    try {
      onChanged(
        await procurementApi.command(
          identity.current.request,
          body,
          identity.current.key,
        ),
      );
      setReason('');
      identity.current = null;
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  const editable = ['DRAFT', 'CHANGES_REQUESTED'].includes(request.status);
  return (
    <div className="space-y-5">
      <Card className="space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              {request.number} · نسخه {request.version.toLocaleString('fa-IR')}
            </p>
            <h2 ref={heading} tabIndex={-1} className="mt-2 text-xl font-bold">
              {request.draft.title || 'پیش‌نویس بدون عنوان'}
            </h2>
          </div>
          <Badge>{statusLabels[request.status]}</Badge>
        </div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              'برآورد',
              `${request.draft.estimatedAmount ?? 'نامشخص'} ${request.draft.currencyCode ?? ''}`,
            ],
            ['واحد', request.draft.unitId ?? 'ثبت نشده'],
            ['دسته', request.draft.category || 'ثبت نشده'],
            [
              'فوریت',
              request.draft.urgent
                ? `اضطراری: ${request.draft.urgencyReason}`
                : 'عادی',
            ],
            ['شرح نیاز', request.draft.needReason || 'ثبت نشده'],
            ['تحویل', request.draft.deliveryLocation || 'ثبت نشده'],
            ['مسئول', request.ownerUserId ?? 'بدون مسئول'],
            ['اقدام بعدی', nextAction[request.status]],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words leading-6">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="space-y-2">
          {request.draft.items.map((item) => (
            <p className="rounded-lg bg-muted/40 p-3 text-sm" key={item.id}>
              {item.kind === 'GOODS' ? 'کالا' : 'خدمت'} · {item.description} ·{' '}
              {item.quantity} {item.unit} · معیار پذیرش:{' '}
              {item.acceptanceCriteria || 'ثبت نشده'}
            </p>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          مدارک: {request.draft.documents.length.toLocaleString('fa-IR')} ·{' '}
          {request.draft.notes}
        </p>
        <DocumentLinks documents={request.draft.documents} />
        {error && (
          <Alert tone="error" title="عملیات انجام نشد" description={error} />
        )}
        <fieldset disabled={busy} className="space-y-4">
          <legend className="mb-3 font-semibold">اقدامات پرونده</legend>
          <FormField id="proc-action-reason" label="دلیل تصمیم یا لغو">
            <Textarea
              id="proc-action-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            {editable && can('procurement.request.update') && (
              <Button variant="outline" onClick={onEdit}>
                ویرایش درخواست
              </Button>
            )}
            {!['CANCELLED', 'CLOSED', 'REJECTED'].includes(request.status) &&
              can('procurement.order.cancel') && (
                <Button
                  variant="outline"
                  disabled={!reason.trim()}
                  onClick={() => {
                    if (
                      window.confirm(
                        'پرونده پس از کنترل بسته‌بودن سفارش‌ها و تعیین تکلیف مغایرت‌ها بسته شود؟',
                      )
                    )
                      void command({ action: 'CLOSE_REQUEST', reason });
                  }}
                >
                  بستن پرونده خرید
                </Button>
              )}
            {editable && can('procurement.request.submit') && (
              <Button
                disabled={bootstrap.policy !== 'CONFIGURED'}
                onClick={() => void command({ action: 'SUBMIT' })}
              >
                ارسال برای تأیید
              </Button>
            )}
            {['SUBMITTED', 'IN_REVIEW'].includes(request.status) &&
              can('procurement.approve') && (
                <>
                  <Button
                    onClick={() =>
                      void command({
                        action: 'DECIDE',
                        decision: 'APPROVED',
                        reason,
                      })
                    }
                  >
                    تأیید
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!reason.trim()}
                    onClick={() =>
                      void command({
                        action: 'DECIDE',
                        decision: 'CHANGES_REQUESTED',
                        reason,
                      })
                    }
                  >
                    بازگشت برای اصلاح
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!reason.trim()}
                    onClick={() =>
                      void command({
                        action: 'DECIDE',
                        decision: 'REJECTED',
                        reason,
                      })
                    }
                  >
                    رد درخواست
                  </Button>
                </>
              )}
            {!['CANCELLED', 'CLOSED', 'REJECTED'].includes(request.status) &&
              can('procurement.request.cancel') && (
                <Button
                  variant="outline"
                  disabled={!reason.trim()}
                  onClick={() => {
                    if (window.confirm('درخواست با دلیل واردشده لغو شود؟'))
                      void command({ action: 'CANCEL', reason });
                  }}
                >
                  لغو درخواست
                </Button>
              )}
          </div>
          {can('procurement.assign') && (
            <div className="flex flex-wrap items-end gap-3">
              <ProcurementOwnerPicker
                branchId={request.draft.branchId}
                value={owner}
                onChange={setOwner}
              />
              <Button
                variant="outline"
                disabled={!owner.trim()}
                onClick={() =>
                  void command({ action: 'ASSIGN', ownerUserId: owner })
                }
              >
                تخصیص مسئول
              </Button>
            </div>
          )}
        </fieldset>
      </Card>
      <Card className="space-y-4 p-5">
        <nav aria-label="اسناد پرونده" className="flex flex-wrap gap-2">
          {kinds
            .filter(
              ([value]) => value !== 'audit' || can('procurement.audit.read'),
            )
            .map(([value, label]) => (
              <Button
                size="sm"
                variant={kind === value ? 'secondary' : 'ghost'}
                key={value}
                aria-pressed={kind === value}
                onClick={() => {
                  setKind(value);
                  setPage(1);
                }}
              >
                {label}
              </Button>
            ))}
        </nav>
        {kind === 'audit' && !can('procurement.audit.read') ? (
          <EmptyState
            title="دسترسی به تاریخچه ندارید"
            description="یکی از بخش‌های مجاز پرونده را انتخاب کنید."
          />
        ) : records.isPending ? (
          <Skeleton className="h-40" />
        ) : records.isError ? (
          <Alert
            tone="error"
            title="سوابق دریافت نشد"
            description={errorText(records.error)}
          >
            <Button variant="outline" onClick={() => void records.refetch()}>
              تلاش دوباره
            </Button>
          </Alert>
        ) : (
          <>
            {!records.data.items.length ? (
              <EmptyState
                title="رکوردی ثبت نشده است"
                description="سوابق واقعی این پرونده پس از ثبت عملیات نمایش داده می‌شوند."
              />
            ) : (
              <div className="space-y-3">
                {kind === 'quotations' && (
                  <QuotationComparison records={records.data.items} />
                )}
                {records.data.items.map((record, index) => (
                  <RecordCard
                    key={String(record.id ?? index)}
                    record={record}
                  />
                ))}
              </div>
            )}
            <Pager
              page={page}
              hasMore={records.data.hasMore}
              setPage={setPage}
            />
          </>
        )}
      </Card>
      <OperationForm
        key={kind}
        kind={kind}
        request={request}
        bootstrap={bootstrap}
        onChanged={onChanged}
      />
      {kind === 'orders' && (
        <ProcurementExportPanel
          bootstrap={bootstrap}
          kind="ORDER"
          request={request}
        />
      )}
    </div>
  );
}
const recordLabels: Record<string, string> = {
  number: 'شماره',
  status: 'وضعیت',
  action: 'عملیات',
  reason: 'دلیل',
  createdAt: 'زمان ثبت',
  updatedAt: 'آخرین تغییر',
  amount: 'مبلغ',
  totalAmount: 'مبلغ کل',
  currencyCode: 'ارز',
  supplierId: 'تأمین‌کننده',
  orderId: 'سفارش',
  invoiceNumber: 'شماره فاکتور',
  dueAt: 'سررسید',
  expectedAt: 'موعد تحویل',
  version: 'نسخه',
  quantity: 'مقدار',
  description: 'شرح',
  deliveryAt: 'تاریخ تحویل',
  paymentTerms: 'شرایط پرداخت',
  warranty: 'ضمانت',
  qualityNote: 'ارزیابی کیفیت',
  validUntil: 'اعتبار پیشنهاد',
  quotedAt: 'تاریخ پیشنهاد',
  acceptedQuantity: 'مقدار پذیرفته‌شده',
  rejectedQuantity: 'مقدار ردشده',
  unitPrice: 'قیمت واحد',
  taxAmount: 'مالیات',
  discountAmount: 'تخفیف',
  extraCostAmount: 'هزینه جانبی',
  resolution: 'نتیجه رسیدگی',
  evidence: 'شواهد پذیرش',
  receivedAt: 'تاریخ دریافت',
  acceptedAt: 'تاریخ پذیرش',
  returnedAt: 'تاریخ مرجوعی',
  receivedDelta: 'تغییر مقدار دریافت',
  acceptedDelta: 'تغییر مقدار پذیرفته‌شده',
  rejectedDelta: 'تغییر مقدار ردشده',
  disposition: 'مبدأ مقدار مرجوعی',
};
function recordData(record: Record<string, unknown>) {
  return {
    ...(typeof record.data === 'object' && record.data !== null
      ? record.data
      : {}),
    ...record,
  } as Record<string, unknown>;
}
function RecordCard({ record }: { record: Record<string, unknown> }) {
  const entries = Object.entries(recordData(record)).filter(
    ([key, value]) =>
      key in recordLabels && value !== null && typeof value !== 'object',
  );
  return (
    <div className="rounded-xl border border-border p-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt className="text-muted-foreground">{recordLabels[key]}</dt>
            <dd className="mt-1 break-words">
              {formatProcurementRecordValue(key, value)}
            </dd>
          </div>
        ))}
      </dl>
      {!entries.length && <p className="text-sm">رکورد ثبت‌شده</p>}
      <DocumentLinks documents={recordData(record).documents} />
      {Array.isArray(record.lines) && record.lines.length > 0 && (
        <details className="mt-4 rounded-xl bg-muted/30 p-3">
          <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            اقلام و مبالغ ({record.lines.length.toLocaleString('fa-IR')} ردیف)
          </summary>
          <div className="mt-3 space-y-3">
            {(record.lines as Record<string, unknown>[]).map((line, index) => (
              <RecordCard key={String(line.id ?? index)} record={line} />
            ))}
          </div>
        </details>
      )}
      <p className="mt-3 break-all text-xs text-muted-foreground">
        شناسه: {String(record.id ?? '—')}
      </p>
    </div>
  );
}
function DocumentLinks({ documents }: { documents: unknown }) {
  if (!Array.isArray(documents)) return null;
  const references = documents.filter(
    (value): value is { id: string; versionId: string } =>
      value !== null &&
      typeof value === 'object' &&
      typeof value.id === 'string' &&
      typeof value.versionId === 'string',
  );
  if (!references.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        مدرک در آرشیو اسناد باز می‌شود؛ نسخه مرجع این پرونده کنار هر پیوند درج
        شده است.
      </p>
      {references.map((reference, index) => (
        <div
          key={`${reference.id}-${reference.versionId}`}
          className="flex flex-wrap items-center gap-2"
        >
          <Button asChild variant="outline" size="sm">
            <a
              href={`/documents?document=${encodeURIComponent(reference.id)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              مشاهده مدرک {(index + 1).toLocaleString('fa-IR')} (زبانه جدید)
            </a>
          </Button>
          <span className="break-all text-xs text-muted-foreground">
            نسخه مرجع: {reference.versionId}
          </span>
        </div>
      ))}
    </div>
  );
}

export function QuotationComparison({
  records,
}: {
  records: Record<string, unknown>[];
}) {
  const currencies = new Set(records.map((row) => String(row.currencyCode)));
  return (
    <div className="space-y-3">
      {currencies.size > 1 && (
        <Alert
          tone="warning"
          title="پیشنهادها ارز متفاوت دارند"
          description="بدون تصویر نرخ ارز معتبر، تبدیل و رتبه‌بندی بین ارزها انجام نمی‌شود. مبالغ با ارز اصلی نمایش داده می‌شوند."
        />
      )}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] text-right text-sm">
          <caption className="p-3 text-start font-semibold">
            مقایسه پیشنهادهای این صفحه
          </caption>
          <thead className="border-y border-border bg-muted/40">
            <tr>
              {[
                'تأمین‌کننده',
                'مبلغ و ارز',
                'وضعیت و اعتبار',
                'کیفیت',
                'موعد تحویل',
                'ضمانت',
                'شرایط پرداخت',
              ].map((label) => (
                <th key={label} scope="col" className="p-3 font-semibold">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const data = recordData(record);
              return (
                <tr
                  key={String(record.id)}
                  className="border-b border-border last:border-0"
                >
                  <td className="max-w-40 break-all p-3">
                    {String(data.supplierName ?? data.supplierId)}
                  </td>
                  <td className="p-3" dir="ltr">
                    {String(data.totalAmount ?? '—')}{' '}
                    {String(data.currencyCode ?? '')}
                  </td>
                  <td className="p-3">
                    {String(data.status ?? '—')}
                    <br />
                    {data.validUntil
                      ? formatProcurementDate(data.validUntil)
                      : 'اعتبار ثبت نشده'}
                  </td>
                  <td className="p-3">
                    {String(data.qualityNote ?? 'ثبت نشده')}
                  </td>
                  <td className="p-3">
                    {data.deliveryAt
                      ? formatProcurementDate(data.deliveryAt)
                      : 'ثبت نشده'}
                  </td>
                  <td className="p-3">{String(data.warranty ?? 'ثبت نشده')}</td>
                  <td className="p-3">
                    {String(data.paymentTerms ?? 'ثبت نشده')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
