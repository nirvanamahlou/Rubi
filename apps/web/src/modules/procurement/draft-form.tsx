'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Package } from 'lucide-react';
import type {
  ProcurementDraftV1,
  ProcurementListV1,
  ProcurementRequestV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { cleanSalesMoney, MoneyInput } from '@/components/ui/money-input';
import { Alert, Card } from '@/components/ui/surfaces';
import {
  ProcurementApiError,
  procurementApi,
  retryIdentity,
  type Bootstrap,
} from './api';
import { emptyDraft, reconcileDraft } from './model';
import { ProcurementSelect } from './procurement-select';
import { ProcurementOwnerPicker } from './owner-picker';

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
export const savedRequestFieldOptionsKey = [
  'procurement',
  'saved-request-field-options',
] as const;
export type PublishDraftIssue = { controlId: string; message: string };

/** Mirrors the API submission rules so publish never creates a hidden draft. */
export function validatePublishDraft(
  draft: ProcurementDraftV1,
): PublishDraftIssue | null {
  const required: readonly [string | null | undefined, string, string][] = [
    [draft.title, 'proc-title', 'عنوان درخواست را وارد کنید.'],
    [draft.category, 'proc-category', 'دسته خرید را انتخاب کنید.'],
    [draft.requiredAt, 'proc-requiredAt', 'تاریخ نیاز را انتخاب کنید.'],
    [draft.currencyCode, 'proc-currency', 'ارز را انتخاب کنید.'],
  ];
  for (const [value, controlId, message] of required)
    if (!value?.trim()) return { controlId, message };
  if (draft.title.length > 300)
    return {
      controlId: 'proc-title',
      message: 'عنوان درخواست حداکثر ۳۰۰ نویسه است.',
    };
  if (!draft.items.length)
    return {
      controlId: 'proc-add-item',
      message: 'حداقل یک کالا یا خدمت اضافه کنید.',
    };
  for (const item of draft.items) {
    if (item.kind === 'SERVICE' && !item.description?.trim())
      return {
        controlId: `${item.id}-description`,
        message: 'شرح همهٔ اقلام و خدمات را وارد کنید.',
      };
    if (!item.unit?.trim())
      return {
        controlId: `${item.id}-unit`,
        message: 'واحد سنجش همهٔ اقلام و خدمات را انتخاب کنید.',
      };
    if (!/^\d+(?:\.\d+)?$/.test(item.quantity) || Number(item.quantity) <= 0)
      return {
        controlId: `${item.id}-quantity`,
        message: 'مقدار هر قلم باید عددی مثبت باشد.',
      };
  }
  return null;
}
export function rememberSavedRequestFieldOptions(
  client: ReturnType<typeof useQueryClient>,
  request: ProcurementRequestV1,
) {
  client.setQueryData<ProcurementListV1<ProcurementRequestV1>>(
    savedRequestFieldOptionsKey,
    (current) => ({
      items: [
        request,
        ...(current?.items ?? []).filter((item) => item.id !== request.id),
      ],
      page: current?.page ?? 1,
      pageSize: Math.max(current?.pageSize ?? 0, 1),
      hasMore: current?.hasMore ?? false,
    }),
  );
}
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
  const queryClient = useQueryClient();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const [draft, setDraft] = useState<ProcurementDraftV1>(() =>
    request
      ? structuredClone(request.draft)
      : emptyDraft(
          bootstrap.requester?.unitId,
          bootstrap.requester?.branchId ??
            bootstrap.defaultBranchId ??
            bootstrap.branches[0]?.id ??
            '',
        ),
  );
  const [requesterEmployeeId, setRequesterEmployeeId] = useState(
    request?.requesterEmployeeId ?? bootstrap.requester?.id ?? '',
  );
  const [requesterLabel, setRequesterLabel] = useState(
    request
      ? (request.requesterEmployeeId ?? request.requesterUserId)
      : (bootstrap.requester?.label ?? ''),
  );
  const [requesterSearch, setRequesterSearch] = useState('');
  const [requesterPage, setRequesterPage] = useState(1);
  const [ownerUserId, setOwnerUserId] = useState(request?.ownerUserId ?? '');
  const canAssign = bootstrap.permissions.includes('procurement.assign');
  const canChooseOwner = bootstrap.permissions.includes(
    'procurement.request.create',
  );
  const requesters = useQuery({
    queryKey: [
      'procurement',
      'requesters',
      draft.branchId,
      draft.unitId,
      requesterSearch,
      requesterPage,
    ],
    queryFn: () =>
      procurementApi.requesters(
        draft.branchId,
        requesterSearch,
        requesterPage,
        draft.unitId ?? '',
      ),
    enabled: Boolean(draft.branchId),
    retry: false,
  });
  const units = useQuery({
    queryKey: ['procurement', 'units', draft.branchId],
    queryFn: () => procurementApi.units(draft.branchId),
    enabled: Boolean(draft.branchId),
    retry: false,
  });
  const categories = useQuery({
    queryKey: ['procurement', 'categories', draft.branchId],
    queryFn: () => procurementApi.categories(draft.branchId),
    enabled: Boolean(draft.branchId),
    retry: false,
  });
  const savedRequests = useQuery({
    queryKey: savedRequestFieldOptionsKey,
    queryFn: () =>
      procurementApi.list(
        new URLSearchParams({
          page: '1',
          queue: 'own',
          search: '',
          status: '',
        }),
      ),
    retry: false,
  });
  const [customFields, setCustomFields] = useState({
    category: false,
  });
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [customItemFields, setCustomItemFields] = useState<
    Record<string, boolean>
  >({});
  const resolvedRequesterLabel =
    requesters.data?.items.find((item) => item.id === requesterEmployeeId)
      ?.label ?? requesterLabel;
  const [busy, setBusy] = useState(false);
  const [baseRequest, setBaseRequest] = useState(request);
  const [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState<ProcurementRequestV1 | null>(null);
  const [choices, setChoices] = useState<
    Partial<Record<keyof ProcurementDraftV1, 'mine' | 'latest'>>
  >({});
  const [error, setError] = useState('');
  const [errorTitle, setErrorTitle] = useState('ذخیره انجام نشد');
  const identity = useRef<ReturnType<typeof retryIdentity> | null>(null);
  const busyRef = useRef(false);
  async function saveCategoryChoice() {
    const label = draft.category.trim();
    if (!label || !draft.branchId || savingCategory) return;
    setSavingCategory(true);
    setCategoryError('');
    try {
      const saved = await procurementApi.createCategory(draft.branchId, label);
      queryClient.setQueryData<
        ProcurementListV1<{ id: string; label: string }>
      >(['procurement', 'categories', draft.branchId], (current) => ({
        items: [
          saved,
          ...(current?.items ?? []).filter((item) => item.id !== saved.id),
        ],
        page: 1,
        pageSize: 500,
        hasMore: false,
      }));
      update('category', saved.label);
      setCustomFields((previous) => ({ ...previous, category: false }));
    } catch (caught) {
      setCategoryError(
        caught instanceof Error ? caught.message : 'ذخیره دسته انجام نشد.',
      );
    } finally {
      setSavingCategory(false);
    }
  }
  function focusControl(controlId: string) {
    requestAnimationFrame(() => {
      const control = document.getElementById(controlId);
      control?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      control?.focus();
    });
  }

  function update<K extends keyof ProcurementDraftV1>(
    key: K,
    value: ProcurementDraftV1[K],
  ) {
    setError('');
    setConflict(false);
    setDraft((previous) => ({ ...previous, [key]: value }));
  }
  const text = (
    key:
      | 'title'
      | 'category'
      | 'needReason'
      | 'urgencyReason'
      | 'unknownEstimateReason'
      | 'deliveryLocation'
      | 'notes',
    label: string,
    multiline = false,
    required = false,
    maxLength?: number,
  ) => (
    <FormField id={`proc-${key}`} label={label} required={required}>
      {multiline ? (
        <Textarea
          id={`proc-${key}`}
          aria-required={required}
          maxLength={maxLength}
          value={draft[key]}
          onChange={(event) => update(key, event.target.value)}
        />
      ) : (
        <Input
          id={`proc-${key}`}
          aria-required={required}
          maxLength={maxLength}
          value={draft[key]}
          onChange={(event) => update(key, event.target.value)}
        />
      )}
    </FormField>
  );
  const savedChoice = (key: 'category', label: string, required = false) => {
    const existing = [
      ...new Set(
        [
          request?.draft[key]?.trim() ?? '',
          ...(key === 'category'
            ? (categories.data?.items ?? []).map((item) => item.label.trim())
            : []),
          ...(savedRequests.data?.items ?? [])
            .filter(
              (item) =>
                !draft.branchId || item.draft.branchId === draft.branchId,
            )
            .map((item) => (item.draft[key] ?? '').trim()),
        ].filter(Boolean),
      ),
    ];
    const custom =
      customFields[key] ||
      (draft[key] !== '' && !existing.includes(draft[key]));
    return (
      <FormField id={`proc-${key}`} label={label} required={required}>
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setCustomFields((previous) => ({ ...previous, [key]: true }));
              update(key, '');
              focusControl(`proc-new-${key}`);
            }}
          >
            افزودن دسته خرید
          </Button>
          <ProcurementSelect
            id={`proc-${key}`}
            required={required}
            value={custom ? '__new__' : draft[key]}
            onChange={(event) => {
              const selected = event.target.value;
              setCustomFields((previous) => ({
                ...previous,
                [key]: selected === '__new__',
              }));
              update(key, selected === '__new__' ? '' : selected);
            }}
          >
            <option value="">انتخاب از موارد ثبت‌شده</option>
            {existing.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
            <option value="__new__">ثبت مورد جدید</option>
          </ProcurementSelect>
          {(custom || existing.length === 0) && (
            <div className="space-y-1.5">
              <Input
                id={`proc-new-${key}`}
                aria-label={`مقدار تازهٔ ${label}`}
                aria-required={required}
                value={draft[key]}
                onChange={(event) => update(key, event.target.value)}
                placeholder="مقدار تازه را وارد کنید"
              />
              {key === 'category' && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!draft[key].trim() || savingCategory}
                    onClick={() => void saveCategoryChoice()}
                  >
                    {savingCategory
                      ? 'در حال ذخیره…'
                      : 'ذخیره دسته در فهرست شعبه'}
                  </Button>
                  {categoryError && (
                    <p role="alert" className="text-xs text-destructive">
                      {categoryError}
                    </p>
                  )}
                </>
              )}
              {key !== 'category' && (
                <p className="text-xs leading-5 text-muted-foreground">
                  با ذخیرهٔ پیش‌نویس، این مورد به فهرست انتخاب‌ها اضافه می‌شود.
                </p>
              )}
            </div>
          )}
        </div>
      </FormField>
    );
  };
  const savedItemChoice = (
    item: ProcurementDraftV1['items'][number],
    key: 'unit',
    label: string,
  ) => {
    const fieldId = `${item.id}-${key}`;
    const existing = [
      ...new Set(
        [
          request?.draft.items
            .find((line) => line.id === item.id)
            ?.[key]?.trim() ?? '',
          ...(savedRequests.data?.items ?? [])
            .filter(
              (saved) =>
                !draft.branchId || saved.draft.branchId === draft.branchId,
            )
            .flatMap((saved) =>
              saved.draft.items.map((line) => line[key]?.trim() ?? ''),
            ),
        ].filter(Boolean),
      ),
    ];
    const custom =
      customItemFields[fieldId] ||
      ((item[key] ?? '') !== '' && !existing.includes(item[key]));
    const change = (value: string) =>
      update(
        'items',
        draft.items.map((line) =>
          line.id === item.id ? { ...line, [key]: value } : line,
        ),
      );
    return (
      <FormField id={fieldId} label={label} required>
        <div className="space-y-2">
          <ProcurementSelect
            id={fieldId}
            required
            value={custom ? '__new__' : item[key]}
            onChange={(event) => {
              const isNew = event.target.value === '__new__';
              setCustomItemFields((previous) => ({
                ...previous,
                [fieldId]: isNew,
              }));
              change(isNew ? '' : event.target.value);
            }}
          >
            <option value="">انتخاب از موارد ثبت‌شده</option>
            {existing.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
            <option value="__new__">ثبت مورد جدید</option>
          </ProcurementSelect>
          {(custom || existing.length === 0) && (
            <div className="space-y-1.5">
              <Input
                aria-label={`مقدار تازهٔ ${label}`}
                aria-required="true"
                value={item[key]}
                onChange={(event) => change(event.target.value)}
              />
              <p className="text-xs leading-5 text-muted-foreground">
                با ذخیرهٔ پیش‌نویس، این مورد به فهرست انتخاب‌ها اضافه می‌شود.
              </p>
            </div>
          )}
        </div>
      </FormField>
    );
  };
  async function save(mode: 'DRAFT' | 'PUBLISH' = 'DRAFT') {
    if (busyRef.current) return;
    if (mode === 'PUBLISH') {
      const issue = validatePublishDraft(draft);
      if (issue) {
        setErrorTitle('تأیید و انتشار انجام نشد');
        setError(issue.message);
        focusControl(issue.controlId);
        return;
      }
    }
    busyRef.current = true;
    setBusy(true);
    setError('');
    setErrorTitle(
      mode === 'PUBLISH'
        ? 'تأیید و انتشار انجام نشد'
        : 'ذخیره پیش‌نویس انجام نشد',
    );
    identity.current = retryIdentity(identity.current, {
      draft,
      requesterEmployeeId,
      ownerUserId: canChooseOwner ? ownerUserId : '',
      id: baseRequest?.id,
      version: baseRequest?.version,
      mode,
    });
    try {
      let saved = await procurementApi.save(
        draft,
        identity.current.key,
        baseRequest,
        requesterEmployeeId,
        mode === 'PUBLISH',
        canChooseOwner && !baseRequest ? ownerUserId || undefined : undefined,
      );
      if (
        baseRequest &&
        canAssign &&
        ownerUserId &&
        saved.ownerUserId !== ownerUserId
      ) {
        setBaseRequest(saved);
        try {
          saved = await procurementApi.command(
            saved,
            { action: 'ASSIGN', ownerUserId },
            crypto.randomUUID(),
          );
        } catch (caught) {
          setBaseRequest(saved);
          setErrorTitle('درخواست ذخیره شد؛ تخصیص مسئول پیگیری انجام نشد');
          setError(
            caught instanceof Error
              ? caught.message
              : 'تخصیص مسئول پیگیری انجام نشد. از صفحه پرونده دوباره تلاش کنید.',
          );
          setConflict(
            caught instanceof ProcurementApiError && caught.status === 409,
          );
          return;
        }
      }
      rememberSavedRequestFieldOptions(queryClient, saved);
      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ذخیره انجام نشد.');
      setConflict(
        caught instanceof ProcurementApiError && caught.status === 409,
      );
    } finally {
      busyRef.current = false;
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
  return (
    <Card className="overflow-hidden p-5 sm:p-7">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="space-y-7"
      >
        <h2 ref={heading} tabIndex={-1} className="sr-only">
          درخواست خرید
        </h2>
        {error && <Alert tone="error" title={errorTitle} description={error} />}
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
                    <ProcurementSelect
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
                    </ProcurementSelect>
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
        <fieldset
          disabled={busy}
          className="min-w-0 space-y-6 rounded-2xl border border-primary/15 bg-gradient-to-b from-primary/5 via-surface to-surface p-4 sm:p-6"
        >
          <legend className="mb-5 w-full border-b border-primary/15 pb-4 text-base font-bold text-foreground">
            <span className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ClipboardList aria-hidden="true" className="size-5" />
              </span>
              اطلاعات درخواست
            </span>
          </legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {text('title', 'عنوان درخواست', false, true, 300)}
            <FormField id="proc-requester" label="درخواست‌کننده">
              {request ? (
                <Input
                  id="proc-requester"
                  readOnly
                  value={resolvedRequesterLabel}
                />
              ) : (
                <div className="space-y-2">
                  <Input
                    aria-label="جست‌وجوی درخواست‌کننده در منابع انسانی"
                    placeholder="جست‌وجوی کارمند"
                    value={requesterSearch}
                    onChange={(event) => {
                      setRequesterSearch(event.target.value);
                      setRequesterPage(1);
                    }}
                  />
                  <ProcurementSelect
                    id="proc-requester"
                    className={selectClass}
                    value={requesterEmployeeId}
                    onChange={(event) => {
                      setError('');
                      const candidate = requesters.data?.items.find(
                        (item) => item.id === event.target.value,
                      );
                      setRequesterEmployeeId(event.target.value);
                      setRequesterLabel(candidate?.label ?? '');
                      update('unitId', candidate?.unitId ?? null);
                    }}
                  >
                    <option value="">انتخاب از کارکنان فعال</option>
                    {requesterEmployeeId &&
                      !requesters.data?.items.some(
                        (item) => item.id === requesterEmployeeId,
                      ) && (
                        <option value={requesterEmployeeId}>
                          {resolvedRequesterLabel || 'درخواست‌کننده انتخاب‌شده'}
                        </option>
                      )}
                    {requesters.data?.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </ProcurementSelect>
                  {requesters.isError && (
                    <p className="text-sm text-destructive">
                      فهرست کارکنان دریافت نشد.
                    </p>
                  )}
                  {requesters.data?.hasMore && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRequesterPage((page) => page + 1)}
                    >
                      کارکنان بعدی
                    </Button>
                  )}
                </div>
              )}
            </FormField>
            <FormField id="proc-branch" label="شعبه">
              <ProcurementSelect
                id="proc-branch"
                className={selectClass}
                value={draft.branchId}
                onChange={(event) => {
                  update('branchId', event.target.value);
                  setOwnerUserId('');
                  if (!request) {
                    setRequesterEmployeeId('');
                    setRequesterLabel('');
                    update('unitId', null);
                    setRequesterPage(1);
                  }
                }}
              >
                <option value="">انتخاب شعبه</option>
                {bootstrap.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.label}
                  </option>
                ))}
              </ProcurementSelect>
            </FormField>
            {canChooseOwner && (!request || canAssign) && (
              <div className="space-y-2">
                <ProcurementOwnerPicker
                  branchId={draft.branchId}
                  value={ownerUserId}
                  onChange={setOwnerUserId}
                  label="مسئول پیگیری"
                  {...(request?.ownerUserId
                    ? {
                        initialOption: {
                          id: request.ownerUserId,
                          label: `مسئول فعلی (${request.ownerUserId.slice(0, 8)})`,
                        },
                      }
                    : {})}
                />
                <p className="text-xs text-muted-foreground">
                  فقط مسئولان فعال و مجاز خرید در همین شعبه قابل انتخاب‌اند.
                  مسئول پیگیری کار را در کارتابل خود می‌بیند؛ اختیار تأیید فقط
                  از سیاست مصوب خرید می‌آید.
                </p>
              </div>
            )}
            <FormField id="proc-unit" label="واحد سازمانی">
              <ProcurementSelect
                id="proc-unit"
                className={selectClass}
                value={draft.unitId ?? ''}
                onChange={(event) => {
                  const nextUnit = event.target.value || null;
                  const requester = requesters.data?.items.find(
                    (item) => item.id === requesterEmployeeId,
                  );
                  update('unitId', nextUnit);
                  if (
                    nextUnit &&
                    requester?.unitId &&
                    requester.unitId !== nextUnit
                  ) {
                    setRequesterEmployeeId('');
                    setRequesterLabel('');
                  }
                  setRequesterPage(1);
                }}
              >
                <option value="">انتخاب واحد از منابع انسانی</option>
                {draft.unitId &&
                  !units.data?.items.some(
                    (unit) => unit.id === draft.unitId,
                  ) && <option value={draft.unitId}>{draft.unitId}</option>}
                {units.data?.items.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.label}
                  </option>
                ))}
              </ProcurementSelect>
              {units.isError && (
                <p className="text-sm text-destructive">
                  فهرست واحدهای منابع انسانی دریافت نشد.
                </p>
              )}
            </FormField>
            {savedChoice('category', 'دسته خرید', true)}
            <FormField id="proc-requiredAt" label="تاریخ نیاز" required>
              <DatePicker
                id="proc-requiredAt"
                aria-required
                value={draft.requiredAt?.slice(0, 10) ?? ''}
                onChange={(value) =>
                  update('requiredAt', value ? `${value}T00:00:00.000Z` : null)
                }
              />
            </FormField>
            <FormField id="proc-deliveryLocation" label="محل تحویل">
              <ProcurementSelect
                id="proc-deliveryLocation"
                className={selectClass}
                value={draft.deliveryLocation}
                onChange={(event) =>
                  update('deliveryLocation', event.target.value)
                }
              >
                <option value="">انتخاب محل تحویل (اختیاری)</option>
                {bootstrap.branches.map((branch) => (
                  <option key={branch.id} value={branch.label}>
                    {branch.label}
                  </option>
                ))}
              </ProcurementSelect>
            </FormField>
          </div>
          {text('needReason', 'شرح نیاز و توجیه خرید', true, false, 4000)}
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={draft.urgent}
              onChange={(event) => update('urgent', event.target.checked)}
            />
            خرید اضطراری است
          </label>
          {draft.urgent &&
            text('urgencyReason', 'دلیل اضطرار', true, true, 1000)}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="proc-estimate" label="مبلغ">
              <MoneyInput
                id="proc-estimate"
                value={draft.estimatedAmount ?? ''}
                onValueChange={(estimatedAmount) =>
                  update('estimatedAmount', estimatedAmount || null)
                }
              />
            </FormField>
            <FormField id="proc-currency" label="ارز" required>
              <ProcurementSelect
                id="proc-currency"
                className={selectClass}
                required
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
              </ProcurementSelect>
            </FormField>
          </div>
        </fieldset>
        <fieldset
          disabled={busy}
          className="min-w-0 space-y-4 rounded-2xl border border-violet-200/70 bg-gradient-to-b from-violet-500/5 via-surface to-surface p-4 dark:border-violet-400/25 sm:p-6"
        >
          <legend className="mb-5 w-full border-b border-violet-200/70 pb-4 text-base font-bold text-foreground dark:border-violet-400/25">
            <span className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300">
                <Package aria-hidden="true" className="size-5" />
              </span>
              اقلام و خدمات
              <span className="ms-auto text-xs font-medium text-muted-foreground">
                {draft.items.length.toLocaleString('fa-IR')} ردیف
              </span>
            </span>
          </legend>
          {draft.items.map((item, index) => (
            <div
              key={item.id}
              className="space-y-4 rounded-xl border border-violet-200/70 bg-violet-500/[0.03] p-4 dark:border-violet-400/25"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-200/70 pb-3 dark:border-violet-400/25">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-foreground">
                    ردیف {(index + 1).toLocaleString('fa-IR')}
                  </h3>
                  <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300">
                    {item.kind === 'GOODS' ? 'کالا' : 'خدمت'}
                  </span>
                </div>
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
                  <ProcurementSelect
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
                  </ProcurementSelect>
                </FormField>
                {(
                  [
                    ['description', 'شرح'],
                    ['specification', 'مشخصات فنی'],
                    ['quantity', 'مقدار'],
                    ['unit', 'واحد سنجش'],
                  ] as const
                )
                  .filter(
                    ([key]) => item.kind === 'SERVICE' || key !== 'description',
                  )
                  .map(([key, label]) =>
                    key === 'unit' ? (
                      <div key={key}>{savedItemChoice(item, key, label)}</div>
                    ) : (
                      <FormField
                        key={key}
                        id={`${item.id}-${key}`}
                        label={label}
                        required={key === 'description' || key === 'quantity'}
                      >
                        <Input
                          id={`${item.id}-${key}`}
                          aria-required={
                            key === 'description' || key === 'quantity'
                          }
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
                    ),
                  )}
              </div>
            </div>
          ))}
          <Button
            id="proc-add-item"
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
        <div className="flex flex-wrap gap-3 border-t border-border pt-5">
          <Button type="submit" loading={busy}>
            ذخیره پیش‌نویس
          </Button>
          <Button
            type="button"
            loading={busy}
            onClick={() => void save('PUBLISH')}
          >
            تأیید و انتشار
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (
                JSON.stringify(draft) ===
                  JSON.stringify(
                    request?.draft ??
                      emptyDraft(
                        bootstrap.requester?.unitId,
                        bootstrap.requester?.branchId ??
                          bootstrap.defaultBranchId ??
                          bootstrap.branches[0]?.id ??
                          '',
                      ),
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
