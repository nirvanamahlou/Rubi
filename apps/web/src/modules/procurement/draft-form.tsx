'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  DocumentListItemV1,
  ProcurementDraftV1,
  ProcurementRequestV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { cleanSalesMoney } from '@/components/ui/money-input';
import { Alert, Card } from '@/components/ui/surfaces';
import { documentsApi } from '@/modules/documents/api/client';
import {
  ProcurementApiError,
  procurementApi,
  retryIdentity,
  type Bootstrap,
} from './api';
import { emptyDraft, reconcileDraft } from './model';

export const selectClass =
  'h-11 w-full rounded-xl border border-input bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const draftLabels: Record<keyof ProcurementDraftV1, string> = {
  title: 'عنوان',
  branchId: 'شعبه',
  unitId: 'واحد',
  purchaseType: 'نوع خرید',
  category: 'دسته',
  needReason: 'شرح نیاز',
  requiredAt: 'تاریخ نیاز',
  priority: 'اولویت',
  urgent: 'اضطرار',
  urgencyReason: 'دلیل اضطرار',
  estimatedAmount: 'برآورد',
  currencyCode: 'ارز',
  unknownEstimateReason: 'دلیل نامشخص بودن برآورد',
  deliveryLocation: 'محل تحویل',
  notes: 'یادداشت',
  documents: 'پیوست‌ها',
  items: 'اقلام',
  origin: 'مرجع مبدأ',
};
function describeDraftValue(
  value: ProcurementDraftV1[keyof ProcurementDraftV1],
): string {
  if (value === null || value === '') return 'ثبت نشده';
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر';
  if (Array.isArray(value))
    return (
      value
        .map((item) =>
          'description' in item
            ? `${item.description} (${item.quantity} ${item.unit})`
            : `${item.id} · ${item.versionId}`,
        )
        .join('، ') || 'بدون مورد'
    );
  if (typeof value === 'object')
    return value.kind === 'GENERAL'
      ? 'خرید عمومی'
      : `${value.operationId} · نسخه ${value.version}`;
  return String(value);
}
export function DraftForm({
  bootstrap,
  request,
  onSaved,
  onClose,
}: {
  bootstrap: Bootstrap;
  request?: ProcurementRequestV1;
  onSaved: (value: ProcurementRequestV1) => void;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const [draft, setDraft] = useState<ProcurementDraftV1>(() =>
    request
      ? structuredClone(request.draft)
      : emptyDraft(bootstrap.requester?.unitId),
  );
  const [requesterEmployeeId, setRequesterEmployeeId] = useState(
    request?.requesterEmployeeId ?? bootstrap.requester?.id ?? '',
  );
  const [requesterLabel, setRequesterLabel] = useState(
    request ? request.requesterEmployeeId ?? request.requesterUserId : bootstrap.requester?.label ?? '',
  );
  const [requesterSearch, setRequesterSearch] = useState('');
  const [requesterPage, setRequesterPage] = useState(1);
  const requesters = useQuery({
    queryKey: ['procurement', 'requesters', draft.branchId, requesterSearch, requesterPage],
    queryFn: () => procurementApi.requesters(draft.branchId, requesterSearch, requesterPage),
    enabled: Boolean(draft.branchId),
    retry: false,
  });
  const resolvedRequesterLabel =
    requesters.data?.items.find((item) => item.id === requesterEmployeeId)?.label ??
    requesterLabel;
  const [busy, setBusy] = useState(false);
  const [baseRequest, setBaseRequest] = useState(request);
  const [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState<ProcurementRequestV1 | null>(null);
  const [choices, setChoices] = useState<
    Partial<Record<keyof ProcurementDraftV1, 'mine' | 'latest'>>
  >({});
  const [error, setError] = useState('');
  const [documents, setDocuments] = useState<readonly DocumentListItemV1[]>([]);
  const [documentError, setDocumentError] = useState('');
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [documentsBusy, setDocumentsBusy] = useState(false);
  const identity = useRef<ReturnType<typeof retryIdentity> | null>(null);
  function update<K extends keyof ProcurementDraftV1>(
    key: K,
    value: ProcurementDraftV1[K],
  ) {
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  const text = (
    key:
      | 'title'
      | 'purchaseType'
      | 'category'
      | 'needReason'
      | 'urgencyReason'
      | 'unknownEstimateReason'
      | 'deliveryLocation'
      | 'notes',
    label: string,
    multiline = false,
  ) => (
    <FormField id={`proc-${key}`} label={label}>
      {multiline ? (
        <Textarea
          id={`proc-${key}`}
          value={draft[key]}
          onChange={(event) => update(key, event.target.value)}
        />
      ) : (
        <Input
          id={`proc-${key}`}
          value={draft[key]}
          onChange={(event) => update(key, event.target.value)}
        />
      )}
    </FormField>
  );
  async function save() {
    if (!baseRequest && !requesterEmployeeId) {
      setError('درخواست‌کننده را از فهرست کارکنان انتخاب کنید.');
      return;
    }
    setBusy(true);
    setError('');
    identity.current = retryIdentity(identity.current, {
      draft,
      requesterEmployeeId,
      id: baseRequest?.id,
      version: baseRequest?.version,
    });
    try {
      onSaved(
        await procurementApi.save(draft, identity.current.key, baseRequest, requesterEmployeeId),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ذخیره انجام نشد.');
      setConflict(
        caught instanceof ProcurementApiError && caught.status === 409,
      );
    } finally {
      setBusy(false);
    }
  }
  async function compareLatest() {
    if (!baseRequest) return;
    setBusy(true);
    try {
      setLatest(await procurementApi.get(baseRequest.id));
      setChoices({});
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'نسخه جدید دریافت نشد.',
      );
    } finally {
      setBusy(false);
    }
  }
  const reconciliation =
    latest && baseRequest
      ? reconcileDraft(baseRequest.draft, draft, latest.draft)
      : null;
  async function loadDocuments() {
    setDocumentsBusy(true);
    setDocumentError('');
    try {
      const result = await documentsApi.list({
        page: 1,
        pageSize: 20,
        domain: 'PROCUREMENT',
        ...(draft.branchId ? { branchId: draft.branchId } : {}),
        search: documentSearch,
      });
      setDocuments(result.data);
      setDocumentsLoaded(true);
    } catch (caught) {
      setDocumentError(
        caught instanceof Error ? caught.message : 'اسناد در دسترس نیست.',
      );
    } finally {
      setDocumentsBusy(false);
    }
  }
  return (
    <Card className="p-5 sm:p-7">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="space-y-7"
      >
        <div>
          <h2 ref={heading} tabIndex={-1} className="text-xl font-bold">
            {request ? `ویرایش ${request.number}` : 'درخواست خرید جدید'}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            پیش‌نویس ناقص قابل ذخیره است. اطلاعات مورد نیاز هنگام ارسال کنترل
            می‌شود.
          </p>
        </div>
        {error && (
          <Alert tone="error" title="ذخیره انجام نشد" description={error} />
        )}
        {conflict && baseRequest && (
          <div className="space-y-4 rounded-xl border border-border p-4">
            <Button
              type="button"
              variant="outline"
              loading={busy}
              onClick={() => void compareLatest()}
            >
              دریافت نسخه جدید برای مقایسه
            </Button>
            {latest && reconciliation && (
              <>
                <p className="text-sm">
                  نسخه سرور: {latest.version.toLocaleString('fa-IR')} · وضعیت:{' '}
                  {latest.status}. تغییرات مستقل با حفظ هر دو طرف ترکیب می‌شوند.
                  برای فیلدهای هم‌زمان تغییرکرده، مقدار مورد نظر را انتخاب کنید.
                </p>
                {reconciliation.conflicts.map((key) => (
                  <FormField
                    key={key}
                    id={`conflict-${key}`}
                    label={draftLabels[key]}
                  >
                    <div className="grid gap-2 text-sm sm:grid-cols-2">
                      <p className="rounded-lg bg-muted/40 p-3">
                        ورودی شما: {describeDraftValue(draft[key])}
                      </p>
                      <p className="rounded-lg bg-muted/40 p-3">
                        نسخه جدید: {describeDraftValue(latest.draft[key])}
                      </p>
                    </div>
                    <select
                      id={`conflict-${key}`}
                      className={selectClass}
                      value={choices[key] ?? ''}
                      onChange={(event) =>
                        setChoices((previous) => ({
                          ...previous,
                          [key]: event.target.value as 'mine' | 'latest',
                        }))
                      }
                    >
                      <option value="">انتخاب مقدار</option>
                      <option value="mine">حفظ ورودی من</option>
                      <option value="latest">حفظ نسخه جدید</option>
                    </select>
                  </FormField>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    reconciliation.conflicts.some((key) => !choices[key]) ||
                    !['DRAFT', 'CHANGES_REQUESTED'].includes(latest.status)
                  }
                  onClick={() => {
                    const merged = reconciliation.merged;
                    for (const key of reconciliation.conflicts)
                      if (choices[key] === 'mine')
                        Object.assign(merged, { [key]: draft[key] });
                    setDraft(merged);
                    setBaseRequest(latest);
                    setLatest(null);
                    setConflict(false);
                    setError('');
                  }}
                >
                  ادامه ویرایش با انتخاب‌های بالا
                </Button>
              </>
            )}
          </div>
        )}
        <fieldset disabled={busy} className="space-y-6">
          <legend className="mb-4 font-bold">اطلاعات درخواست</legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {text('title', 'عنوان درخواست')}
            <FormField id="proc-requester" label="درخواست‌کننده">
              {request ? (
                <Input id="proc-requester" readOnly value={resolvedRequesterLabel} />
              ) : (
                <div className="space-y-2">
                  <Input
                    aria-label="جست‌وجوی درخواست‌کننده در منابع انسانی"
                    placeholder="جست‌وجوی کارمند"
                    value={requesterSearch}
                    onChange={(event) => { setRequesterSearch(event.target.value); setRequesterPage(1); }}
                  />
                  <select
                    id="proc-requester"
                    className={selectClass}
                    value={requesterEmployeeId}
                    onChange={(event) => {
                      const candidate = requesters.data?.items.find((item) => item.id === event.target.value);
                      setRequesterEmployeeId(event.target.value);
                      setRequesterLabel(candidate?.label ?? '');
                      update('unitId', candidate?.unitId ?? null);
                    }}
                  >
                    <option value="">انتخاب از کارکنان فعال</option>
                    {requesterEmployeeId && !requesters.data?.items.some((item) => item.id === requesterEmployeeId) && (
                      <option value={requesterEmployeeId}>{resolvedRequesterLabel || 'درخواست‌کننده انتخاب‌شده'}</option>
                    )}
                    {requesters.data?.items.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                  {requesters.isError && <p className="text-sm text-destructive">فهرست کارکنان دریافت نشد.</p>}
                  {requesters.data?.hasMore && (
                    <Button type="button" variant="outline" onClick={() => setRequesterPage((page) => page + 1)}>
                      کارکنان بعدی
                    </Button>
                  )}
                </div>
              )}
            </FormField>
            <FormField id="proc-branch" label="شعبه">
              <select
                id="proc-branch"
                className={selectClass}
                value={draft.branchId}
                onChange={(event) => {
                  update('branchId', event.target.value);
                  if (!request) { setRequesterEmployeeId(''); setRequesterLabel(''); update('unitId', null); setRequesterPage(1); }
                }}
              >
                <option value="">انتخاب شعبه</option>
                {bootstrap.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="proc-unit" label="واحد سازمانی">
              <Input
                id="proc-unit"
                readOnly
                value={draft.unitId ?? 'واحدی برای درخواست‌کننده ثبت نشده'}
              />
            </FormField>
            {text('purchaseType', 'نوع خرید')}
            {text('category', 'دسته خرید')}
            <FormField id="proc-requiredAt" label="تاریخ نیاز">
              <DatePicker
                id="proc-requiredAt"
                value={draft.requiredAt?.slice(0, 10) ?? ''}
                onChange={(value) =>
                  update('requiredAt', value ? `${value}T00:00:00.000Z` : null)
                }
              />
            </FormField>
            <FormField id="proc-priority" label="اولویت">
              <select
                id="proc-priority"
                className={selectClass}
                value={draft.priority}
                onChange={(event) =>
                  update(
                    'priority',
                    event.target.value as ProcurementDraftV1['priority'],
                  )
                }
              >
                <option value="LOW">کم</option>
                <option value="NORMAL">عادی</option>
                <option value="HIGH">زیاد</option>
              </select>
            </FormField>
            <FormField id="proc-deliveryLocation" label="محل تحویل">
              <select
                id="proc-deliveryLocation"
                className={selectClass}
                value={draft.deliveryLocation}
                onChange={(event) => update('deliveryLocation', event.target.value)}
              >
                <option value="">انتخاب محل تحویل (اختیاری)</option>
                {bootstrap.branches.map((branch) => (
                  <option key={branch.id} value={branch.label}>{branch.label}</option>
                ))}
              </select>
            </FormField>
          </div>
          {text('needReason', 'شرح نیاز و توجیه خرید', true)}
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={draft.urgent}
              onChange={(event) => update('urgent', event.target.checked)}
            />
            خرید اضطراری است
          </label>
          {draft.urgent && text('urgencyReason', 'دلیل اضطرار', true)}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="proc-estimate" label="مبلغ">
              <Input
                id="proc-estimate"
                dir="ltr"
                inputMode="decimal"
                value={draft.estimatedAmount ?? ''}
                onChange={(event) =>
                  update(
                    'estimatedAmount',
                    cleanSalesMoney(event.target.value) || null,
                  )
                }
              />
            </FormField>
            <FormField id="proc-currency" label="ارز">
              <select
                id="proc-currency"
                className={selectClass}
                value={draft.currencyCode ?? ''}
                onChange={(event) =>
                  update('currencyCode', event.target.value || null)
                }
              >
                <option value="">انتخاب ارز</option>
                {bootstrap.currencies.map((currency) => (
                  <option key={currency.id} value={currency.code}>
                    {currency.name} ({currency.code})
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </fieldset>
        <fieldset disabled={busy} className="space-y-4">
          <legend className="mb-4 font-bold">اقلام و خدمات</legend>
          {draft.items.map((item, index) => (
            <div
              key={item.id}
              className="space-y-4 rounded-xl border border-border bg-muted/20 p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  ردیف {(index + 1).toLocaleString('fa-IR')}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    update(
                      'items',
                      draft.items.filter((value) => value.id !== item.id),
                    )
                  }
                >
                  حذف ردیف
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField id={`${item.id}-kind`} label="ماهیت">
                  <select
                    id={`${item.id}-kind`}
                    className={selectClass}
                    value={item.kind}
                    onChange={(event) =>
                      update(
                        'items',
                        draft.items.map((value) =>
                          value.id === item.id
                            ? {
                                ...value,
                                kind: event.target.value as 'GOODS' | 'SERVICE',
                              }
                            : value,
                        ),
                      )
                    }
                  >
                    <option value="GOODS">کالا</option>
                    <option value="SERVICE">خدمت</option>
                  </select>
                </FormField>
                {(
                  [
                    ['description', 'شرح'],
                    ['specification', 'مشخصات فنی'],
                    ['quantity', 'مقدار'],
                    ['unit', 'واحد سنجش'],
                    ['period', 'دوره ارائه خدمت'],
                  ] as const
                ).map(([key, label]) => (
                  <FormField key={key} id={`${item.id}-${key}`} label={label}>
                    <Input
                      id={`${item.id}-${key}`}
                      value={item[key]}
                      onChange={(event) =>
                        update(
                          'items',
                          draft.items.map((value) =>
                            value.id === item.id
                              ? {
                                  ...value,
                                  [key]:
                                    key === 'quantity'
                                      ? cleanSalesMoney(event.target.value)
                                      : event.target.value,
                                }
                              : value,
                          ),
                        )
                      }
                    />
                  </FormField>
                ))}
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              update('items', [
                ...draft.items,
                {
                  id: crypto.randomUUID(),
                  kind: 'GOODS',
                  description: '',
                  specification: '',
                  quantity: '',
                  unit: '',
                  acceptanceCriteria: '',
                  period: '',
                },
              ])
            }
          >
            افزودن کالا یا خدمت
          </Button>
        </fieldset>
        <fieldset disabled={busy} className="space-y-4">
          <legend className="mb-4 font-bold">اسناد و مرجع مبدأ</legend>
          <FormField id="proc-origin" label="منشأ درخواست">
            <select
              id="proc-origin"
              className={selectClass}
              value={draft.origin.kind}
              onChange={(event) =>
                update(
                  'origin',
                  event.target.value === 'GENERAL'
                    ? { kind: 'GENERAL' }
                    : {
                        kind: 'SPECIALIZED',
                        module: 'RESERVATIONS',
                        operationId: '',
                        version: 1,
                      },
                )
              }
            >
              <option value="GENERAL">خرید عمومی شرکت</option>
              <option value="SPECIALIZED">ارجاع از رزرواسیون</option>
            </select>
          </FormField>
          {draft.origin.kind === 'SPECIALIZED' && (
            <>
              <Alert
                title="مرجع عملیات تخصصی"
                description="عملیات سفر در رزرواسیون باقی می‌ماند. اعتبار مرجع و نسخه هنگام ارسال در سرور کنترل می‌شود."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="proc-origin-id" label="شناسه عملیات">
                  <Input
                    id="proc-origin-id"
                    value={draft.origin.operationId}
                    onChange={(event) => {
                      if (draft.origin.kind === 'SPECIALIZED')
                        update('origin', {
                          ...draft.origin,
                          operationId: event.target.value,
                        });
                    }}
                  />
                </FormField>
                <FormField id="proc-origin-version" label="نسخه مرجع">
                  <Input
                    id="proc-origin-version"
                    type="number"
                    min={1}
                    value={draft.origin.version}
                    onChange={(event) => {
                      if (draft.origin.kind === 'SPECIALIZED')
                        update('origin', {
                          ...draft.origin,
                          version: Number(event.target.value),
                        });
                    }}
                  />
                </FormField>
              </div>
            </>
          )}
          {bootstrap.documents === 'AVAILABLE' ? (
            <>
              <div className="flex gap-2">
                <Input
                  aria-label="جست‌وجوی اسناد موجود"
                  value={documentSearch}
                  onChange={(event) => setDocumentSearch(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  loading={documentsBusy}
                  onClick={() => void loadDocuments()}
                >
                  جست‌وجوی اسناد
                </Button>
              </div>
              {documentError && (
                <Alert
                  title="دریافت اسناد ناموفق بود"
                  tone="error"
                  description={documentError}
                />
              )}
              {documentsLoaded && !documents.length && (
                <p className="text-sm text-muted-foreground">
                  سند قابل دسترسی پیدا نشد.
                </p>
              )}
              {documents.map((document) => (
                <label
                  className="flex min-h-11 items-center gap-3 text-sm"
                  key={document.id}
                >
                  <input
                    type="checkbox"
                    checked={draft.documents.some(
                      (value) => value.id === document.id,
                    )}
                    onChange={(event) =>
                      update(
                        'documents',
                        event.target.checked
                          ? [
                              ...draft.documents.filter(
                                (value) => value.id !== document.id,
                              ),
                              {
                                id: document.id,
                                versionId: document.currentVersion.id,
                              },
                            ]
                          : draft.documents.filter(
                              (value) => value.id !== document.id,
                            ),
                      )
                    }
                  />
                  {document.title} · {document.archiveCode}
                </label>
              ))}
            </>
          ) : (
            <Alert
              title="سرویس اسناد در دسترس نیست"
              description="افزودن پیوست پس از دسترس‌پذیر شدن سرویس اسناد ممکن است."
            />
          )}
          {draft.documents.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">
                پیوست‌های انتخاب‌شده:{' '}
                {draft.documents.length.toLocaleString('fa-IR')}
              </p>
              {draft.documents.map((document) => (
                <div
                  key={document.id}
                  className="flex flex-wrap items-center gap-2 text-xs"
                >
                  <span className="break-all" dir="ltr">
                    {document.id}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      update(
                        'documents',
                        draft.documents.filter(
                          (value) => value.id !== document.id,
                        ),
                      )
                    }
                  >
                    حذف پیوست
                  </Button>
                </div>
              ))}
            </div>
          )}
          {text('notes', 'یادداشت تکمیلی', true)}
        </fieldset>
        <div className="flex flex-wrap gap-3 border-t border-border pt-5">
          <Button type="submit" loading={busy}>
            ذخیره پیش‌نویس
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (
                JSON.stringify(draft) ===
                  JSON.stringify(
                    request?.draft ?? emptyDraft(bootstrap.requester?.unitId),
                  ) ||
                window.confirm('تغییرات ذخیره‌نشده کنار گذاشته شود؟')
              )
                onClose();
            }}
          >
            بستن فرم
          </Button>
        </div>
      </form>
    </Card>
  );
}
