'use client';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BadgeCheck,
  Building2,
  ClipboardList,
  Clock3,
  Package,
  ReceiptText,
  RotateCcw,
} from 'lucide-react';
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
import { InternalSections } from './internal-sections';
import { ProcurementOwnerPicker } from './owner-picker';
import { ProcurementExportPanel } from './export-panel';
import {
  formatProcurementDate,
  formatProcurementRecordValue,
} from './presentation';
import { sampleRequests, type ProcurementListRow } from './sample-requests';
import { ProcurementSelect } from './procurement-select';
import { ProcurementRecordActions } from './record-actions';
import { MasterDataDateRangeFilter } from '@/modules/master-data/components/master-data-date-range-filter';
import { cn } from '@/lib/utils';
import {
  usePageBreadcrumbs,
  type PageBreadcrumb,
} from '@/components/layout/page-breadcrumbs';

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
const areaTone = {
  1: {
    icon: ClipboardList,
    border: 'border-blue-300/70 dark:border-blue-400/25',
    glow: 'from-blue-400/20 dark:from-blue-400/12',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-400/20 dark:text-blue-300',
  },
  3: {
    icon: Building2,
    border: 'border-cyan-300/70 dark:border-cyan-400/25',
    glow: 'from-cyan-400/20 dark:from-cyan-400/12',
    badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-400/20 dark:text-cyan-300',
  },
  5: {
    icon: Package,
    border: 'border-sky-300/70 dark:border-sky-400/25',
    glow: 'from-sky-400/20 dark:from-sky-400/12',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-400/20 dark:text-sky-300',
  },
  7: {
    icon: ReceiptText,
    border: 'border-rose-300/70 dark:border-rose-400/25',
    glow: 'from-rose-400/20 dark:from-rose-400/12',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-400/20 dark:text-rose-300',
  },
} as const;
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
      className="space-y-6 bg-background font-sans text-foreground"
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
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
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
  const updateAddress = useCallback(
    (section: number, requestId: string | null) => {
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
    },
    [],
  );
  const navigateGroup = useCallback(
    (index: number) => {
      setGroup(index);
      setPage(1);
      setSelectedId(null);
      setCreating(false);
      setEditing(false);
      updateAddress(index, null);
    },
    [updateAddress],
  );
  function openRequest(id: string) {
    setSelectedId(id);
    updateAddress(group, id);
  }
  const closeRequest = useCallback(() => {
    setSelectedId(null);
    updateAddress(group, null);
  }, [group, updateAddress]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuerySearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const queryQueue = 'own';
  const list = useQuery({
    queryKey: [
      'procurement',
      'requests',
      page,
      querySearch,
      status,
      queryQueue,
      createdFrom,
      createdTo,
    ],
    queryFn: () =>
      procurementApi.list(
        new URLSearchParams({
          page: String(page),
          search: querySearch,
          status,
          queue: queryQueue,
          createdFrom,
          createdTo,
        }),
      ),
    enabled: group === 0,
    retry: false,
  });
  const detail = useQuery({
    queryKey: ['procurement', 'request', selectedId],
    queryFn: () => procurementApi.get(selectedId!),
    enabled: !!selectedId,
    retry: false,
  });
  const detailNumber = detail.data?.number ?? null;
  const breadcrumbs = useMemo<readonly PageBreadcrumb[]>(() => {
    const items: PageBreadcrumb[] = [
      {
        key: 'purchases',
        title: 'خرید و تأمین',
        ...(group > 0 || selectedId
          ? { onSelect: () => navigateGroup(0) }
          : {}),
      },
    ];
    if (group > 0)
      items.push({
        key: sectionKeys[group] ?? 'home',
        title: groups[group] ?? groups[0],
        ...(selectedId ? { onSelect: closeRequest } : {}),
      });
    if (selectedId && detailNumber)
      items.push({
        key: `request-${selectedId}`,
        title: detailNumber,
      });
    return items;
  }, [group, selectedId, detailNumber, navigateGroup, closeRequest]);
  usePageBreadcrumbs('/purchases', breadcrumbs);
  const showSamples =
    group === 0 &&
    page === 1 &&
    !status &&
    !createdFrom &&
    !createdTo &&
    !search &&
    !querySearch &&
    list.isSuccess &&
    list.data.items.length === 0;
  const rows: ProcurementListRow[] = showSamples
    ? sampleRequests.filter((item) => item.section === undefined)
    : (list.data?.items ?? []);
  function saved(request: ProcurementRequestV1) {
    setCreating(false);
    setEditing(false);
    openRequest(request.id);
    client.setQueryData(['procurement', 'request', request.id], request);
    void client.invalidateQueries({ queryKey: ['procurement', 'requests'] });
    void client.invalidateQueries({
      queryKey: ['procurement', 'section-list'],
    });
    void client.invalidateQueries({
      queryKey: ['procurement', 'operation-options'],
    });
  }
  async function removeRequest(request: ProcurementRequestV1) {
    await procurementApi.remove(request);
    if (selectedId === request.id) closeRequest();
    setEditing(false);
    await Promise.all([
      client.invalidateQueries({ queryKey: ['procurement', 'requests'] }),
      client.invalidateQueries({ queryKey: ['procurement', 'section-list'] }),
      client.invalidateQueries({
        queryKey: ['procurement', 'request', request.id],
      }),
      client.invalidateQueries({
        queryKey: ['procurement', 'operation-options'],
      }),
    ]);
  }
  async function deleteListRequest(row: ProcurementListRow) {
    const result = await procurementApi.get(row.id);
    await removeRequest(result);
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
  if (group > 0)
    return (
      <InternalSections
        key={group}
        group={group as 1 | 2 | 3 | 4 | 5 | 6 | 7}
        bootstrap={bootstrap}
        selectedId={selectedId}
        {...(detail.data ? { request: detail.data } : {})}
        detailPending={detail.isPending}
        detailError={detail.isError ? detail.error : null}
        onRetryDetail={() => void detail.refetch()}
        onOpen={openRequest}
        onClose={closeRequest}
        onCreate={() => setCreating(true)}
        onSaved={saved}
        onDelete={removeRequest}
      />
    );
  return (
    <div className="space-y-5">
      {selectedId ? (
        <div className="space-y-4">
          <Button variant="outline" onClick={closeRequest}>
            بازگشت به میزکار
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
          ) : detail.data ? (
            <RequestDetail
              key={detail.data.id}
              request={detail.data}
              bootstrap={bootstrap}
              onEdit={() => setEditing(true)}
              onChanged={saved}
              initialKind="audit"
            />
          ) : null}
        </div>
      ) : (
        <>
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black sm:text-3xl">میزکار خرید</h1>
            </div>
            {can('procurement.request.create') && (
              <Button onClick={() => setCreating(true)}>
                درخواست خرید جدید
              </Button>
            )}
          </header>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                [
                  'در انتظار بررسی',
                  rows.filter(
                    (row) =>
                      row.status === 'SUBMITTED' || row.status === 'IN_REVIEW',
                  ).length,
                  Clock3,
                  'border-blue-300/70 dark:border-blue-400/25',
                  'from-blue-400/20 dark:from-blue-400/12',
                  'bg-blue-100 text-blue-700 dark:bg-blue-400/20 dark:text-blue-300',
                ],
                [
                  'در مسیر تأمین',
                  rows.filter(
                    (row) =>
                      row.status === 'APPROVED' || row.status === 'SOURCING',
                  ).length,
                  BadgeCheck,
                  'border-emerald-300/70 dark:border-emerald-400/25',
                  'from-emerald-400/20 dark:from-emerald-400/12',
                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300',
                ],
                [
                  'نیازمند اصلاح',
                  rows.filter((row) => row.status === 'CHANGES_REQUESTED')
                    .length,
                  RotateCcw,
                  'border-amber-300/70 dark:border-amber-400/25',
                  'from-amber-400/20 dark:from-amber-400/12',
                  'bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-300',
                ],
              ] as const
            ).map(([label, count, Icon, border, glow, badge]) => (
              <Card
                key={label}
                className={cn('relative overflow-hidden p-5', border)}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent',
                    glow,
                  )}
                />
                <div className="relative flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    {label}
                  </p>
                  <span
                    className={cn(
                      'grid size-10 place-items-center rounded-xl',
                      badge,
                    )}
                  >
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                </div>
                <p className="relative mt-3 text-2xl font-black">
                  {list.isPending ? '—' : count.toLocaleString('fa-IR')}
                </p>
              </Card>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {([1, 3, 5, 7] as const).map((index) => {
              const tone = areaTone[index];
              const Icon = tone.icon;
              return (
                <button
                  key={sectionKeys[index]}
                  type="button"
                  onClick={() => navigateGroup(index)}
                  className={cn(
                    'group relative min-h-40 overflow-hidden rounded-2xl border bg-surface p-5 text-right shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    tone.border,
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent',
                      tone.glow,
                    )}
                  />
                  <span className="relative flex items-center gap-3">
                    <span
                      className={cn(
                        'grid size-12 place-items-center rounded-2xl transition-transform group-hover:scale-105',
                        tone.badge,
                      )}
                    >
                      <Icon aria-hidden="true" className="size-6" />
                    </span>
                    <span className="text-sm font-black">{groups[index]}</span>
                  </span>
                  <span className="relative mt-8 block border-t border-border/70 pt-3 text-xs font-semibold text-primary">
                    ورود به بخش ←
                  </span>
                </button>
              );
            })}
          </div>
          <Card className="overflow-hidden border-blue-300/70 dark:border-blue-400/25">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-gradient-to-l from-blue-400/15 to-transparent p-5 dark:from-blue-400/8">
              <h2 className="font-bold">پیگیری‌های من</h2>
              <div className="grid w-full items-end gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-[minmax(150px,220px)_minmax(130px,170px)_minmax(280px,330px)] lg:[&>fieldset]:col-span-1">
                <FormField id="proc-home-search" label="شماره یا عنوان">
                  <Input
                    id="proc-home-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </FormField>
                <FormField id="proc-home-status" label="وضعیت">
                  <ProcurementSelect
                    id="proc-home-status"
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
                  </ProcurementSelect>
                </FormField>
                <MasterDataDateRangeFilter
                  title="تاریخ ثبت پرونده"
                  fromDate={createdFrom}
                  toDate={createdTo}
                  idPrefix="proc-home"
                  onFromDateChange={(value) => {
                    setCreatedFrom(value.slice(0, 10));
                    if (createdTo && value && value > createdTo)
                      setCreatedTo('');
                    setPage(1);
                  }}
                  onToDateChange={(value) => {
                    setCreatedTo(value.slice(0, 10));
                    if (createdFrom && value && value < createdFrom)
                      setCreatedFrom('');
                    setPage(1);
                  }}
                  onReset={() => {
                    setCreatedFrom('');
                    setCreatedTo('');
                    setPage(1);
                  }}
                />
              </div>
            </div>
            {list.isPending ? (
              <Skeleton className="m-5 h-52" />
            ) : list.isError ? (
              <div className="p-5">
                <Alert
                  tone="error"
                  title="درخواست‌ها دریافت نشدند"
                  description={errorText(list.error)}
                />
              </div>
            ) : rows.length ? (
              <div className="divide-y divide-border">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {row.draft.title || 'درخواست بدون عنوان'}
                      </p>
                      <p
                        className="mt-1 text-xs text-muted-foreground"
                        dir="ltr"
                      >
                        {row.number}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{statusLabels[row.status]}</Badge>
                      {row.sample ? <Badge>نمونه</Badge> : null}
                      <ProcurementRecordActions
                        label={row.draft.title || row.number}
                        onEdit={() => {
                          if (!row.sample) openRequest(row.id);
                        }}
                        onDelete={async () => {
                          if (row.sample) {
                            throw new Error(
                              'رکورد نمونه در این فهرست قابل حذف نیست.',
                            );
                          }
                          await deleteListRequest(row);
                        }}
                        deleteDisabled={
                          row.sample ||
                          !bootstrap.permissions.includes(
                            'procurement.request.cancel',
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                درخواستی پیدا نشد.
              </p>
            )}
            {!showSamples && list.data && (
              <Pager
                page={page}
                hasMore={list.data.hasMore}
                setPage={setPage}
              />
            )}
          </Card>
          <ProcurementExportPanel
            bootstrap={bootstrap}
            kind="REQUESTS"
            query={{ status, search: querySearch, queue: queryQueue }}
          />
        </>
      )}
    </div>
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
              <Button onClick={() => void command({ action: 'PUBLISH' })}>
                تأیید و انتشار
              </Button>
            )}
            {request.status === 'SUBMITTED' &&
              can('procurement.request.submit') && (
                <Button onClick={() => void command({ action: 'SUBMIT' })}>
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
