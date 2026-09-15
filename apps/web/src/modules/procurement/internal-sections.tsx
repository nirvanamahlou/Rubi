'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { ProcurementRequestV1 } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import {
  Alert,
  Badge,
  Card,
  FilterBar,
  PageHeader,
  Skeleton,
} from '@/components/ui/surfaces';
import { masterDataApi } from '@/modules/master-data/api/client';
import { MasterDataLiveForm } from '@/modules/master-data/components/master-data-live-form';
import { getMasterDataDefinition } from '@/modules/master-data/model/catalog';
import { procurementApi, commandAttempt, type Bootstrap } from './api';
import { DraftForm, selectClass } from './draft-form';
import { statusLabels } from './model';
import { OperationForm } from './operation-form';
import { ProcurementSelect } from './procurement-select';
import {
  sampleRequests,
  sampleSuppliers,
  type ProcurementListRow,
} from './sample-requests';

const sections = {
  1: {
    title: 'درخواست‌های خرید',
    list: 'درخواست‌ها',
    form: 'فرم درخواست خرید',
  },
  2: { title: 'تأییدهای من', list: 'در انتظار تصمیم', form: 'فرم تصمیم خرید' },
  3: { title: 'تأمین‌کنندگان', list: 'تأمین‌کنندگان', form: 'فرم تأمین‌کننده' },
  4: {
    title: 'استعلام‌ها و پیشنهادها',
    list: 'پرونده‌های استعلام',
    form: 'فرم پیشنهاد تأمین‌کننده',
  },
  5: {
    title: 'سفارش‌های خرید',
    list: 'پرونده‌های سفارش',
    form: 'فرم سفارش خرید',
  },
  6: {
    title: 'دریافت، پذیرش و مغایرت',
    list: 'پرونده‌های تحویل',
    form: 'فرم دریافت و پذیرش',
  },
  7: {
    title: 'فاکتورها و ارتباط مالی',
    list: 'پرونده‌های فاکتور',
    form: 'فرم فاکتور خرید',
  },
} as const;

type SectionIndex = keyof typeof sections;
const sectionQuery: Partial<Record<SectionIndex, string>> = {
  4: 'quotes',
  5: 'orders',
  6: 'receipts',
  7: 'invoices',
};
const sectionKinds: Partial<Record<SectionIndex, readonly [string, string][]>> =
  {
    4: [['quotations', 'پیشنهادها']],
    5: [['orders', 'سفارش‌ها']],
    6: [
      ['receipts', 'رسید کالا'],
      ['acceptances', 'پذیرش خدمت'],
      ['discrepancies', 'مغایرت'],
      ['returns', 'مرجوعی'],
      ['adjustments', 'اصلاح رسید'],
    ],
    7: [
      ['invoices', 'فاکتورها'],
      ['handoffs', 'ارجاع مالی'],
    ],
  };
const sectionStatuses: Partial<
  Record<SectionIndex, readonly ProcurementRequestV1['status'][]>
> = {
  1: [
    'DRAFT',
    'SUBMITTED',
    'IN_REVIEW',
    'CHANGES_REQUESTED',
    'APPROVED',
    'SOURCING',
    'REJECTED',
    'CANCELLED',
    'CLOSED',
  ],
  4: ['APPROVED', 'SOURCING'],
  5: ['SOURCING', 'CLOSED'],
  6: ['SOURCING', 'CLOSED'],
  7: ['SOURCING', 'CLOSED'],
};
const previewFields: Record<SectionIndex, readonly [string, string][]> = {
  1: [
    ['عنوان درخواست', 'تجهیزات پشتیبانی شعبه'],
    ['درخواست‌کننده', 'کارمند شعبه مرکزی'],
    ['موعد موردنیاز', '۱۴۰۵/۰۶/۲۸'],
  ],
  2: [
    ['تصمیم', 'تأیید / بازگشت / رد'],
    ['دلیل تصمیم', 'شرح تصمیم'],
  ],
  3: [
    ['نام تأمین‌کننده', 'تأمین تجهیزات آریا'],
    ['کد تأمین‌کننده', 'SUP-DEMO-101'],
    ['وضعیت همکاری', 'در حال بررسی'],
  ],
  4: [
    ['تأمین‌کننده', 'تأمین تجهیزات آریا'],
    ['مبلغ پیشنهاد', '۲۸۰٬۰۰۰٬۰۰۰ IRR'],
    ['اعتبار پیشنهاد', '۱۴۰۵/۰۶/۳۰'],
  ],
  5: [
    ['پیشنهاد منتخب', 'QT-DEMO-108'],
    ['موعد تحویل', '۱۴۰۵/۰۷/۰۵'],
    ['محل تحویل', 'شعبه مرکزی'],
  ],
  6: [
    ['سفارش خرید', 'PO-DEMO-110'],
    ['مقدار تحویل', '۱۰'],
    ['مقدار پذیرفته‌شده', '۹'],
  ],
  7: [
    ['شماره فاکتور', 'INV-DEMO-114'],
    ['سفارش خرید', 'PO-DEMO-110'],
    ['مبلغ فاکتور', '۳۹۰٬۰۰۰٬۰۰۰ IRR'],
  ],
};
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'دریافت اطلاعات ناموفق بود.';

export function InternalSections({
  group,
  bootstrap,
  selectedId,
  request,
  detailPending,
  detailError,
  onRetryDetail,
  onOpen,
  onClose,
  onCreate,
  onSaved,
}: {
  group: SectionIndex;
  bootstrap: Bootstrap;
  selectedId: string | null;
  request?: ProcurementRequestV1;
  detailPending: boolean;
  detailError: unknown;
  onRetryDetail: () => void;
  onOpen: (id: string) => void;
  onClose: () => void;
  onCreate: () => void;
  onSaved: (request: ProcurementRequestV1) => void;
}) {
  const [search, setSearch] = useState('');
  const [querySearch, setQuerySearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [candidate, setCandidate] = useState('');
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuerySearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const list = useQuery({
    queryKey: ['procurement', 'section-list', group, page, querySearch, status],
    queryFn: () =>
      procurementApi.list(
        new URLSearchParams({
          page: String(page),
          search: querySearch,
          status,
          queue: group === 2 ? 'approvals' : '',
          section: sectionQuery[group] ?? '',
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
  const showSamples =
    group !== 3 &&
    page === 1 &&
    !search &&
    !querySearch &&
    !status &&
    list.isSuccess &&
    !list.data.items.length;
  const rows: ProcurementListRow[] = showSamples
    ? sampleRequests.filter((item) =>
        group === 1
          ? item.section === undefined || item.section === 1
          : item.section === group,
      )
    : (list.data?.items ?? []);
  const realRows = rows.filter((row) => !row.sample);
  const supplierRows = suppliers.data?.items.length
    ? suppliers.data.items
    : page === 1 && !search && !querySearch
      ? sampleSuppliers
      : [];
  const title = sections[group];

  async function persistSupplier(
    values: Record<string, string>,
    logoChange?: Parameters<
      typeof masterDataApi.persistWithLogo
    >[0]['logoChange'],
  ) {
    await masterDataApi.persistWithLogo({
      resource: 'suppliers',
      values,
      title: `تأمین‌کننده ${values.name ?? values.legalName ?? ''}`.trim(),
      ...(logoChange ? { logoChange } : {}),
    });
    setSupplierFormOpen(false);
    await suppliers.refetch();
  }

  return (
    <div className="space-y-5" data-procurement-section={group}>
      <Link
        href="/purchases"
        className="inline-block text-xs text-muted-foreground hover:text-primary"
      >
        روبی / خرید و تأمین
      </Link>
      <PageHeader
        title={title.title}
        actions={
          group === 7 && bootstrap.finance === 'CONNECTED' ? (
            <Link
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary hover:bg-muted"
              href="/finance/requests"
            >
              کارتابل مالی ←
            </Link>
          ) : undefined
        }
      />

      {selectedId ? (
        <>
          <Button variant="outline" onClick={onClose}>
            بازگشت به فهرست
          </Button>
          {detailPending ? (
            <Skeleton className="h-64" />
          ) : detailError ? (
            <Alert
              tone="error"
              title="پرونده دریافت نشد"
              description={errorText(detailError)}
            >
              <Button
                variant="outline"
                className="mt-3"
                onClick={onRetryDetail}
              >
                تلاش دوباره
              </Button>
            </Alert>
          ) : request ? (
            <SectionRequestForm
              key={`${group}-${request.id}`}
              group={group}
              request={request}
              bootstrap={bootstrap}
              onSaved={onSaved}
              onClose={onClose}
            />
          ) : null}
        </>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
          <section className="min-w-0 space-y-4" aria-label={title.list}>
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
                <h2 className="font-bold">{title.list}</h2>
                <span className="text-xs text-muted-foreground">
                  {group === 3 ? supplierRows.length : rows.length} مورد در این
                  صفحه
                </span>
              </div>
              <FilterBar className="rounded-none border-0 border-b border-border shadow-none">
                <FormField
                  id="proc-section-search"
                  label={
                    group === 3
                      ? 'نام یا کد تأمین‌کننده'
                      : 'شماره یا عنوان پرونده'
                  }
                >
                  <Input
                    id="proc-section-search"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setCandidate('');
                    }}
                    placeholder="جست‌وجو"
                  />
                </FormField>
                {group !== 2 && group !== 3 && (
                  <FormField id="proc-section-status" label="وضعیت پرونده">
                    <ProcurementSelect
                      id="proc-section-status"
                      className={selectClass}
                      value={status}
                      onChange={(event) => {
                        setStatus(event.target.value);
                        setPage(1);
                        setCandidate('');
                      }}
                    >
                      <option value="">همه وضعیت‌ها</option>
                      {(sectionStatuses[group] ?? []).map((value) => (
                        <option key={value} value={value}>
                          {statusLabels[value]}
                        </option>
                      ))}
                    </ProcurementSelect>
                  </FormField>
                )}
              </FilterBar>
              {group === 3 ? (
                suppliers.isPending ? (
                  <Skeleton className="m-5 h-52" />
                ) : suppliers.isError ? (
                  <div className="p-5">
                    <Alert
                      tone="error"
                      title="فهرست تأمین‌کنندگان دریافت نشد"
                      description={errorText(suppliers.error)}
                    />
                  </div>
                ) : supplierRows.length ? (
                  <div className="divide-y divide-border">
                    {supplierRows.map((supplier) => (
                      <div
                        key={supplier.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                      >
                        <div>
                          <p className="font-semibold">{supplier.name}</p>
                          <p
                            className="mt-1 text-xs text-muted-foreground"
                            dir="ltr"
                          >
                            {supplier.code}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge>
                            {supplier.isActive ? 'فعال' : 'غیرفعال'}
                          </Badge>
                          {'sample' in supplier && supplier.sample ? (
                            <Badge>نمونه</Badge>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                    تأمین‌کننده‌ای پیدا نشد.
                  </p>
                )
              ) : list.isPending ? (
                <Skeleton className="m-5 h-52" />
              ) : list.isError ? (
                <div className="p-5">
                  <Alert
                    tone="error"
                    title="فهرست پرونده‌ها دریافت نشد"
                    description={errorText(list.error)}
                  />
                </div>
              ) : rows.length ? (
                <div className="divide-y divide-border">
                  {rows.map((row) => (
                    <div
                      key={row.id}
                      className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
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
                        {row.sample ? (
                          <Badge>نمونه</Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onOpen(row.id)}
                          >
                            باز کردن فرم
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                  پرونده‌ای پیدا نشد.
                </p>
              )}
              {page > 1 ||
              (group === 3 ? suppliers.data?.hasMore : list.data?.hasMore) ? (
                <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => {
                      setPage(page - 1);
                      setCandidate('');
                    }}
                  >
                    قبلی
                  </Button>
                  <span>صفحه {page.toLocaleString('fa-IR')}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      !(group === 3
                        ? suppliers.data?.hasMore
                        : list.data?.hasMore)
                    }
                    onClick={() => {
                      setPage(page + 1);
                      setCandidate('');
                    }}
                  >
                    بعدی
                  </Button>
                </div>
              ) : null}
            </Card>
          </section>

          <Card
            className="space-y-4 p-5 xl:sticky xl:top-4"
            aria-label={title.form}
          >
            <div className="border-b border-border pb-3">
              <h2 className="font-bold">{title.form}</h2>
            </div>
            {group === 1 ? (
              <Button
                className="w-full"
                disabled={
                  !bootstrap.permissions.includes('procurement.request.create')
                }
                onClick={onCreate}
              >
                ثبت درخواست جدید
              </Button>
            ) : group === 3 ? (
              <Button
                className="w-full"
                onClick={() => setSupplierFormOpen(true)}
              >
                ثبت تأمین‌کننده
              </Button>
            ) : (
              <>
                <FormField id="proc-section-request" label="پرونده خرید">
                  <ProcurementSelect
                    id="proc-section-request"
                    className={selectClass}
                    value={candidate}
                    onChange={(event) => setCandidate(event.target.value)}
                  >
                    <option value="">انتخاب پرونده</option>
                    {realRows.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.number} · {row.draft.title}
                      </option>
                    ))}
                  </ProcurementSelect>
                </FormField>
                <Button
                  className="w-full"
                  disabled={!candidate}
                  onClick={() => onOpen(candidate)}
                >
                  باز کردن فرم
                </Button>
              </>
            )}
            <div className="border-t border-border pt-4">
              <Badge>پیش‌نمایش فرم</Badge>
              <fieldset disabled className="mt-3 space-y-3">
                {previewFields[group].map(([label, value], index) => (
                  <FormField
                    key={label}
                    id={`proc-preview-${group}-${index}`}
                    label={label}
                  >
                    <Input
                      id={`proc-preview-${group}-${index}`}
                      defaultValue={value}
                    />
                  </FormField>
                ))}
              </fieldset>
            </div>
          </Card>
        </div>
      )}
      {supplierFormOpen && group === 3 && (
        <MasterDataLiveForm
          definition={getMasterDataDefinition('suppliers')}
          mode="create"
          open
          onOpenChange={setSupplierFormOpen}
          onPersist={persistSupplier}
        />
      )}
    </div>
  );
}

function SectionRequestForm({
  group,
  request,
  bootstrap,
  onSaved,
  onClose,
}: {
  group: SectionIndex;
  request: ProcurementRequestV1;
  bootstrap: Bootstrap;
  onSaved: (request: ProcurementRequestV1) => void;
  onClose: () => void;
}) {
  if (
    group === 1 &&
    ['DRAFT', 'CHANGES_REQUESTED'].includes(request.status) &&
    bootstrap.permissions.includes('procurement.request.update')
  )
    return (
      <DraftForm
        bootstrap={bootstrap}
        request={request}
        onSaved={onSaved}
        onClose={onClose}
      />
    );
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-xs text-muted-foreground" dir="ltr">
            {request.number}
          </p>
          <h2 className="mt-1 text-lg font-bold">
            {request.draft.title || 'درخواست بدون عنوان'}
          </h2>
        </div>
        <Badge>{statusLabels[request.status]}</Badge>
      </Card>
      {group === 2 ? (
        <ApprovalForm
          request={request}
          bootstrap={bootstrap}
          onSaved={onSaved}
        />
      ) : group >= 4 ? (
        <SectionOperations
          group={group}
          request={request}
          bootstrap={bootstrap}
          onSaved={onSaved}
        />
      ) : (
        <Card className="p-5 text-sm text-muted-foreground">
          این درخواست در وضعیت {statusLabels[request.status]} است.
        </Card>
      )}
    </div>
  );
}

function ApprovalForm({
  request,
  bootstrap,
  onSaved,
}: {
  request: ProcurementRequestV1;
  bootstrap: Bootstrap;
  onSaved: (request: ProcurementRequestV1) => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const identity = useRef<ReturnType<typeof commandAttempt> | null>(null);
  const eligible =
    ['SUBMITTED', 'IN_REVIEW'].includes(request.status) &&
    bootstrap.permissions.includes('procurement.approve');
  async function decide(
    decision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED',
  ) {
    const body = { action: 'DECIDE', decision, reason };
    setBusy(true);
    setError('');
    identity.current = commandAttempt(identity.current, request, body);
    try {
      onSaved(
        await procurementApi.command(
          identity.current.request,
          body,
          identity.current.key,
        ),
      );
      identity.current = null;
      setReason('');
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="space-y-4 p-5">
      <h2 className="font-bold">فرم تصمیم خرید</h2>
      {!eligible ? (
        <p className="text-sm text-muted-foreground">
          این پرونده برای تصمیم شما آماده نیست.
        </p>
      ) : (
        <fieldset disabled={busy} className="space-y-4">
          <FormField id="proc-approval-reason" label="دلیل تصمیم">
            <Textarea
              id="proc-approval-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
          {error && (
            <Alert tone="error" title="تصمیم ثبت نشد" description={error} />
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void decide('APPROVED')}>تأیید</Button>
            <Button
              variant="outline"
              disabled={!reason.trim()}
              onClick={() => void decide('CHANGES_REQUESTED')}
            >
              بازگشت برای اصلاح
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim()}
              onClick={() => void decide('REJECTED')}
            >
              رد
            </Button>
          </div>
        </fieldset>
      )}
    </Card>
  );
}

function SectionOperations({
  group,
  request,
  bootstrap,
  onSaved,
}: {
  group: SectionIndex;
  request: ProcurementRequestV1;
  bootstrap: Bootstrap;
  onSaved: (request: ProcurementRequestV1) => void;
}) {
  const kinds = sectionKinds[group] ?? [];
  const [kind, setKind] = useState(kinds[0]?.[0] ?? 'quotations');
  const records = useQuery({
    queryKey: [
      'procurement',
      'section-records',
      request.id,
      request.version,
      kind,
    ],
    queryFn: () => procurementApi.records(request.id, kind, 1),
    retry: false,
  });
  return (
    <div className="space-y-4">
      {kinds.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label="نوع فرم این بخش">
          {kinds.map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={kind === value ? 'secondary' : 'outline'}
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
            >
              {label}
            </Button>
          ))}
        </nav>
      )}
      <OperationForm
        key={kind}
        kind={kind}
        request={request}
        bootstrap={bootstrap}
        onChanged={onSaved}
      />
      <Card className="overflow-hidden">
        <h2 className="border-b border-border px-5 py-4 font-bold">
          سوابق {kinds.find(([value]) => value === kind)?.[1]}
        </h2>
        {records.isPending ? (
          <Skeleton className="m-5 h-24" />
        ) : records.isError ? (
          <div className="p-5">
            <Alert
              tone="error"
              title="سوابق دریافت نشد"
              description={errorText(records.error)}
            />
          </div>
        ) : records.data.items.length ? (
          <div className="divide-y divide-border">
            {records.data.items.map((row, index) => {
              const record = row as Record<string, unknown>;
              return (
                <div
                  key={String(record.id ?? index)}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm"
                >
                  <strong>
                    {String(
                      record.number ??
                        record.invoiceNumber ??
                        record.id ??
                        'رکورد',
                    )}
                  </strong>
                  <span className="text-muted-foreground">
                    {String(record.status ?? '')}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-5 text-sm text-muted-foreground">
            هنوز رکوردی ثبت نشده است.
          </div>
        )}
      </Card>
    </div>
  );
}
