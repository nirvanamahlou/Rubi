'use client';

import { AffairsSelect } from './affairs-select';
import { useState, type FormEvent } from 'react';
import type { CustomerSummary } from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { FormField, Input, Textarea } from '@/components/ui/form-controls';
import { Alert, Card } from '@/components/ui/surfaces';
import { customerAffairsApi } from '../api/customer-affairs-client';
import { CustomerAffairsFormDialog } from './customer-affairs-form-dialog';
import { CustomerPicker } from './customer-picker';
import { AssigneePicker } from './assignee-picker';
import type { Detail } from './customer-affairs-workspace';

export const editableLeadTransitions: Record<string, string[]> = {
  NEW: ['CONTACTED', 'LOST'],
  CONTACTED: ['QUALIFYING', 'NURTURE', 'LOST'],
  QUALIFYING: ['NURTURE', 'LOST'],
  NURTURE: ['CONTACTED', 'LOST'],
  QUALIFIED: ['NURTURE', 'LOST'],
  HANDOFF_PROPOSED: [],
  HANDED_OFF: [],
  LOST: ['NURTURE'],
};
const labels: Record<string, string> = {
  CONTACTED: 'تماس گرفته شد',
  QUALIFYING: 'در حال ارزیابی',
  NURTURE: 'پیگیری بلندمدت',
  LOST: 'از دست‌رفته',
  OPEN: 'باز',
  IN_PROGRESS: 'در حال رسیدگی',
  DONE: 'انجام‌شده',
  CANCELLED: 'لغوشده',
};
export const ticketCategories = [
  ['QUESTION', 'سؤال و راهنمایی'],
  ['ISSUANCE', 'پیگیری صدور'],
  ['COMPLAINT', 'شکایت از خدمت'],
  ['CHANGE', 'تغییر تاریخ یا خدمت'],
  ['CORRECTION', 'اصلاح مشخصات'],
  ['CANCELLATION', 'درخواست کنسلی'],
  ['REFUND', 'پیگیری استرداد'],
  ['DOCUMENT', 'پیگیری مدارک'],
  ['DOCUMENT_RESEND', 'ارسال مجدد مدارک'],
  ['PAYMENT', 'مشکل پرداخت'],
  ['OTHER', 'سایر'],
] as const;
const localDate = (value?: string | null) =>
  value
    ? new Date(
        new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : '';

export function RecordOperations({
  detail,
  onReload,
}: {
  detail: Detail;
  onReload: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'edit' | 'stage' | null>(null);
  const [corrective, setCorrective] = useState<Record<string, unknown> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [target, setTarget] = useState('');
  const lead = 'stage' in detail;
  const values = detail as unknown as Record<string, unknown>;
  function open(value: 'edit' | 'stage') {
    setError('');
    setCustomer(null);
    setTarget('');
    setMode(value);
  }
  async function save(operation: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await operation();
      setMode(null);
      setCorrective(null);
      setNotice('تغییرات ذخیره شد.');
      await onReload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ذخیره انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  async function edit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const changes: Record<string, unknown> = {};
    for (const [key, value] of data.entries())
      changes[key] = String(value).trim() || null;
    if (lead) {
      changes.passengerCount = Number(data.get('passengerCount'));
      const composition = {
        adults: Number(data.get('adults')),
        children: Number(data.get('children')),
        infants: Number(data.get('infants')),
        childAges: String(data.get('childAges') || '')
          .split(/[,،]/)
          .map((x) => x.trim())
          .filter(Boolean)
          .map(Number),
      };
      if (
        changes.passengerCount !==
        composition.adults + composition.children + composition.infants
      ) {
        setError(
          'مجموع بزرگسال، کودک و نوزاد باید با تعداد مسافران برابر باشد.',
        );
        return;
      }
      if (
        composition.childAges.length !== composition.children ||
        composition.childAges.some(
          (age) => !Number.isInteger(age) || age < 0 || age > 17,
        )
      ) {
        setError('سن هر کودک را به ترتیب و با ویرگول وارد کنید (۰ تا ۱۷ سال).');
        return;
      }
      changes.passengerComposition = composition;
      changes.travelStart = data.get('travelStart')
        ? new Date(String(data.get('travelStart'))).toISOString()
        : null;
      changes.travelEnd = data.get('travelEnd')
        ? new Date(String(data.get('travelEnd'))).toISOString()
        : null;
      if (
        changes.travelStart &&
        changes.travelEnd &&
        String(changes.travelEnd) < String(changes.travelStart)
      ) {
        setError('پایان سفر نباید پیش از شروع آن باشد.');
        return;
      }
      changes.requestedServices = String(data.get('requestedServices') || '')
        .split(/[,،]/)
        .map((x) => x.trim())
        .filter(Boolean);
      changes.budget =
        data.get('budgetMaximum') || data.get('budgetMinimum')
          ? {
              ...detail.budget,
              maximum: String(data.get('budgetMaximum')) || null,
              minimum: String(data.get('budgetMinimum')) || null,
              currencyCode: String(data.get('budgetCurrency')),
              basis: detail.budget?.basis || 'TOTAL',
            }
          : { unknownReason: 'بودجه اعلام نشده است' };
    }
    changes.customerId = customer?.id ?? detail.customerId;
    await save(() =>
      customerAffairsApi.updateFollowup(
        detail,
        String(data.get('nextAction')),
        new Date(String(data.get('nextActionAt'))).toISOString(),
        changes,
      ),
    );
  }
  const fields = lead
    ? ([
        ['title', 'عنوان', true],
        ['sourceReference', 'منبع درخواست / نام کمپین یا معرف', true],
        ['originReference', 'مبدأ', false],
        ['destinationReference', 'مقصد', false],
      ] as const)
    : ([
        ['subject', 'موضوع', true],
        ['serviceType', 'نوع خدمت', false],
        ['executionUnit', 'واحد اجرا', false],
      ] as const);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => open('edit')}>
          ویرایش اطلاعات پرونده
        </Button>
        {lead && (editableLeadTransitions[detail.stage]?.length ?? 0) > 0 && (
          <Button variant="outline" onClick={() => open('stage')}>
            تغییر مرحله / ثبت شکست
          </Button>
        )}
      </div>
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {lead && (
        <Card className="grid gap-3 p-4 text-sm sm:grid-cols-2">
          <p>
            منبع:{' '}
            {detail.sourceReference?.startsWith('manual-')
              ? 'ثبت دستی قدیمی؛ منبع تکمیل نشده'
              : detail.sourceReference || 'نامشخص'}
          </p>
          <p>
            مسیر: {detail.originReference || 'نامشخص'} ←{' '}
            {detail.destinationReference || 'نامشخص'}
          </p>
          <p>تعداد مسافر: {detail.passengerCount?.toLocaleString('fa-IR')}</p>
          <p>
            بودجه:{' '}
            {detail.budget?.maximum || detail.budget?.minimum || 'اعلام نشده'}{' '}
            {detail.budget?.currencyCode || ''}
          </p>
          <p>خدمات: {detail.requestedServices?.join('، ') || 'مشخص نشده'}</p>
          <p className="whitespace-pre-wrap">
            توضیحات خاص: {detail.specialPreferences || 'ثبت نشده'}
          </p>
        </Card>
      )}
      {lead && detail.lostReason && (
        <Alert
          title={`دلیل شکست: ${detail.lostReason}`}
          description={detail.lostNote || ''}
          tone="info"
        />
      )}
      {mode === 'edit' && (
        <CustomerAffairsFormDialog
          title="ویرایش اطلاعات پرونده"
          busy={busy}
          onClose={() => setMode(null)}
        >
          <form onSubmit={edit} className="mt-4 grid gap-4 sm:grid-cols-2">
            {fields.map(([key, label, required]) => (
              <FormField key={key} label={label}>
                <Input
                  name={key}
                  defaultValue={String(values[key] || '')}
                  required={required}
                  maxLength={key === 'sourceReference' ? 160 : 200}
                />
              </FormField>
            ))}
            <FormField label="کانال ورود">
              <AffairsSelect
                className="h-11 w-full rounded-xl border border-input bg-surface"
                name={lead ? 'inboundChannel' : 'channel'}
                defaultValue={String(
                  lead ? detail.inboundChannel : detail.channel,
                )}
              >
                {(lead
                  ? [
                      ['PHONE', 'تلفن'],
                      ['WEBSITE', 'وب‌سایت'],
                      ['REFERRAL', 'معرف'],
                      ['WALK_IN', 'حضوری'],
                      ['SOCIAL', 'شبکه اجتماعی'],
                      ['OTHER', 'سایر'],
                    ]
                  : [
                      ['PHONE', 'تلفن'],
                      ['WEBSITE', 'وب‌سایت'],
                      ['EMAIL', 'ایمیل'],
                      ['CHAT', 'گفتگو'],
                      ['WALK_IN', 'حضوری'],
                      ['OTHER', 'سایر'],
                    ]
                ).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </AffairsSelect>
            </FormField>
            <FormField label="اولویت">
              <AffairsSelect
                className="h-11 w-full rounded-xl border border-input bg-surface"
                name="priority"
                defaultValue={detail.priority}
              >
                {[
                  ['LOW', 'کم'],
                  ['NORMAL', 'عادی'],
                  ['HIGH', 'زیاد'],
                  ['URGENT', 'فوری'],
                  ...(!lead ? [['CRITICAL', 'بحرانی']] : []),
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </AffairsSelect>
            </FormField>
            <div className="sm:col-span-2">
              <FormField label={lead ? 'نیاز سفر' : 'شرح درخواست'}>
                <Textarea
                  name={lead ? 'travelNeed' : 'description'}
                  defaultValue={lead ? detail.travelNeed : detail.description}
                  required
                  minLength={3}
                  maxLength={lead ? 1000 : 2000}
                />
              </FormField>
            </div>
            {lead ? (
              <>
                <FormField label="تعداد مسافر">
                  <Input
                    name="passengerCount"
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={detail.passengerCount}
                    required
                  />
                </FormField>
                <FormField label="خدمات موردنیاز (با ویرگول جدا کنید)">
                  <Input
                    name="requestedServices"
                    defaultValue={detail.requestedServices?.join('، ')}
                  />
                </FormField>
                {(['adults', 'children', 'infants'] as const).map((key) => (
                  <FormField
                    key={key}
                    label={
                      { adults: 'بزرگسال', children: 'کودک', infants: 'نوزاد' }[
                        key
                      ]
                    }
                  >
                    <Input
                      name={key}
                      type="number"
                      required
                      min={0}
                      max={100}
                      defaultValue={
                        detail.passengerComposition?.[key] ??
                        (key === 'adults' ? detail.passengerCount : 0)
                      }
                    />
                  </FormField>
                ))}
                <FormField label="سن کودکان (با ویرگول جدا کنید)">
                  <Input
                    name="childAges"
                    defaultValue={
                      detail.passengerComposition?.childAges?.join('، ') || ''
                    }
                  />
                </FormField>
                <FormField label="قطعیت تاریخ">
                  <AffairsSelect
                    name="datePrecision"
                    defaultValue={detail.datePrecision || 'UNKNOWN'}
                    className="h-11 rounded-xl border border-input bg-surface"
                  >
                    {[
                      ['EXACT', 'قطعی'],
                      ['RANGE', 'بازه زمانی'],
                      ['FLEXIBLE', 'منعطف'],
                      ['UNKNOWN', 'نامشخص'],
                    ].map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </AffairsSelect>
                </FormField>
                <FormField label="انعطاف تاریخ">
                  <Input
                    name="dateFlexibility"
                    maxLength={240}
                    defaultValue={detail.dateFlexibility || ''}
                  />
                </FormField>
                <FormField label="شروع سفر">
                  <DatePicker
                    name="travelStart"
                    defaultValue={localDate(detail.travelStart).slice(0, 10)}
                  />
                </FormField>
                <FormField label="پایان سفر">
                  <DatePicker
                    name="travelEnd"
                    defaultValue={localDate(detail.travelEnd).slice(0, 10)}
                  />
                </FormField>
                <FormField label="سقف بودجه">
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    name="budgetMaximum"
                    defaultValue={detail.budget?.maximum || ''}
                  />
                </FormField>
                <FormField label="حداقل بودجه">
                  <Input
                    name="budgetMinimum"
                    type="number"
                    min="0.01"
                    step="0.01"
                    defaultValue={detail.budget?.minimum || ''}
                  />
                </FormField>
                <FormField label="کد ارز بودجه">
                  <Input
                    name="budgetCurrency"
                    defaultValue={detail.budget?.currencyCode || 'IRR'}
                    minLength={3}
                    maxLength={3}
                    required
                  />
                </FormField>
                <FormField label="توضیحات خاص">
                  <Textarea
                    name="specialPreferences"
                    defaultValue={detail.specialPreferences || ''}
                    maxLength={1000}
                  />
                </FormField>
              </>
            ) : (
              <FormField label="دسته تیکت">
                <AffairsSelect
                  name="category"
                  defaultValue={detail.category}
                  className="h-11 w-full rounded-xl border border-input bg-surface"
                >
                  {!ticketCategories.some(
                    ([value]) => value === detail.category,
                  ) && (
                    <option value={detail.category}>{detail.category}</option>
                  )}
                  {ticketCategories.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </AffairsSelect>
              </FormField>
            )}
            <div className="sm:col-span-2">
              <FormField label="مسئول پاسخ‌گویی">
                <AssigneePicker
                  name={lead ? 'assigneeUserId' : 'customerOwnerUserId'}
                  initial={
                    (lead
                      ? detail.assigneeUserId
                      : detail.customerOwnerUserId) || ''
                  }
                  branchId={detail.branchId}
                />
              </FormField>
            </div>
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm">
                {detail.customerId
                  ? 'مشتری فعلی حفظ می‌شود؛ فقط برای تغییر، مشتری دیگری انتخاب کنید.'
                  : 'برای اتصال پرونده، مشتری موجود را انتخاب کنید.'}
              </p>
              <CustomerPicker
                initialCustomerId={detail.customerId ?? null}
                selected={customer}
                onSelect={setCustomer}
                disabled={busy}
              />
            </div>
            <FormField label="اقدام بعدی">
              <Input
                name="nextAction"
                defaultValue={detail.nextAction}
                required
                minLength={3}
              />
            </FormField>
            <FormField label="موعد اقدام">
              <DatePicker
                name="nextActionAt"
                includeTime
                required
                defaultValue={localDate(detail.nextActionAt)}
              />
            </FormField>
            {error && (
              <div className="sm:col-span-2">
                <Alert title="ذخیره نشد" description={error} tone="error" />
              </div>
            )}
            <Button type="submit" disabled={busy}>
              ذخیره تغییرات
            </Button>
          </form>
        </CustomerAffairsFormDialog>
      )}
      {mode === 'stage' && lead && (
        <CustomerAffairsFormDialog
          title="تغییر مرحله درخواست"
          busy={busy}
          onClose={() => setMode(null)}
        >
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void save(() =>
                customerAffairsApi.transitionLead(detail.id, {
                  stage: target,
                  expectedVersion: detail.version,
                  reason: String(data.get('reason')),
                  ...(target === 'LOST'
                    ? { lostReason: String(data.get('lostReason')) }
                    : {}),
                }),
              );
            }}
          >
            <FormField label="مرحله جدید">
              <AffairsSelect
                className="h-11 rounded-xl border border-input bg-surface"
                required
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              >
                <option value="">انتخاب کنید</option>
                {editableLeadTransitions[detail.stage]?.map((stage) => (
                  <option key={stage} value={stage}>
                    {labels[stage]}
                  </option>
                ))}
              </AffairsSelect>
            </FormField>
            {target === 'LOST' && (
              <FormField label="دلیل شکست">
                <AffairsSelect
                  name="lostReason"
                  required
                  className="h-11 rounded-xl border border-input bg-surface"
                >
                  <option value="">انتخاب کنید</option>
                  {[
                    'قیمت و بودجه',
                    'زمان نامناسب',
                    'عدم موجودی خدمت',
                    'انتخاب رقیب',
                    'انصراف از سفر',
                    'عدم امکان تماس',
                    'سایر',
                  ].map((reason) => (
                    <option key={reason}>{reason}</option>
                  ))}
                </AffairsSelect>
              </FormField>
            )}
            <FormField label="توضیح تغییر مرحله">
              <Textarea name="reason" required minLength={3} maxLength={500} />
            </FormField>
            {error && (
              <Alert title="ذخیره نشد" description={error} tone="error" />
            )}
            <Button disabled={busy} type="submit">
              ثبت مرحله
            </Button>
          </form>
        </CustomerAffairsFormDialog>
      )}
      {!!detail.correctiveActions?.length && (
        <Card className="space-y-3 p-4">
          <h3 className="font-bold">اقدامات اصلاحی رضایت مشتری</h3>
          {detail.correctiveActions.map((item) => (
            <div
              key={String(item.id)}
              className="rounded-xl border border-border p-3"
            >
              <p>
                {String(item.title || 'پیگیری نارضایتی')} —{' '}
                {labels[String(item.status)] || String(item.status)}
              </p>
              <p className="text-sm">
                {String(item.result || 'هنوز نتیجه‌ای ثبت نشده است.')}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setError('');
                  setCorrective(item);
                }}
              >
                ثبت نتیجه اقدام اصلاحی
              </Button>
            </div>
          ))}
        </Card>
      )}
      {corrective && (
        <CustomerAffairsFormDialog
          title="نتیجه اقدام اصلاحی"
          busy={busy}
          onClose={() => setCorrective(null)}
        >
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void save(() =>
                customerAffairsApi.updateCorrectiveAction(
                  String(corrective.id),
                  {
                    status: String(data.get('status')),
                    result: String(data.get('result')),
                    effectivenessReview: String(
                      data.get('effectivenessReview'),
                    ),
                    expectedVersion: Number(corrective.version),
                  },
                ),
              );
            }}
          >
            <FormField label="وضعیت">
              <AffairsSelect
                className="h-11 rounded-xl border border-input bg-surface"
                name="status"
                defaultValue={String(corrective.status)}
              >
                {['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'].map((status) => (
                  <option key={status} value={status}>
                    {labels[status]}
                  </option>
                ))}
              </AffairsSelect>
            </FormField>
            <FormField label="نتیجه اقدام">
              <Textarea
                name="result"
                defaultValue={String(corrective.result || '')}
                required
                maxLength={1000}
              />
            </FormField>
            <FormField label="بررسی اثربخشی">
              <Textarea
                name="effectivenessReview"
                defaultValue={String(corrective.effectivenessReview || '')}
                maxLength={1000}
              />
            </FormField>
            {error && (
              <Alert title="ذخیره نشد" description={error} tone="error" />
            )}
            <Button disabled={busy} type="submit">
              ذخیره اقدام اصلاحی
            </Button>
          </form>
        </CustomerAffairsFormDialog>
      )}
    </>
  );
}
