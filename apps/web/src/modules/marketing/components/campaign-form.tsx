'use client';

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { MoneyInput } from '@/components/ui/money-input';
import {
  Checkbox,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui/form-controls';
import { Alert, Badge, Card } from '@/components/ui/surfaces';
import {
  campaignChannelLabels,
  executionCompanyLabels,
  type CampaignChannel,
  type CampaignPreview,
  type ExecutionCompany,
} from '../model/marketing';
import {
  campaignDraftFromPreview,
  type CampaignDraft,
  type MarketingCurrencyCode,
  type SegmentOption,
} from '../model/durable-records';

export type { CampaignDraft } from '../model/durable-records';

export type CampaignFormMode = 'create' | 'view' | 'edit';

interface CampaignFormProps {
  mode: CampaignFormMode;
  campaign?: CampaignPreview | undefined;
  ownerUserId: string;
  segments: readonly SegmentOption[];
  onSave: (draft: CampaignDraft) => Promise<void>;
}

const steps = [
  'مشخصات پایه',
  'هدف و شرکت',
  'کانال‌ها',
  'مخاطب',
  'زمان‌بندی',
  'بودجه',
  'ردیابی و ارسال',
  'انتشار داخلی',
] as const;

const selectableChannels: readonly CampaignChannel[] = [
  'SMS',
  'EMAIL',
  'WHATSAPP',
  'WEBSITE',
  'INSTAGRAM',
  'TELEGRAM',
  'PUSH_NOTIFICATION',
  'PHONE_CALL',
  'PARTNER_AGENCY',
  'REFERRAL',
  'OFFLINE',
];

export function validateDraft(draft: CampaignDraft): string[] {
  const errors: string[] = [];
  if (!/^MKT-[A-Z0-9-]{3,24}$/.test(draft.internalCode)) {
    errors.push(
      'کد داخلی باید با MKT- شروع شود و فقط حروف بزرگ، عدد و خط تیره داشته باشد.',
    );
  }
  if (draft.name.trim().length < 3) errors.push('نام کمپین حداقل ۳ نویسه است.');
  if (draft.objective.trim().length < 3)
    errors.push('هدف کمپین باید مشخص باشد.');
  if (draft.channels.length === 0) errors.push('حداقل یک کانال انتخاب کنید.');
  const startsAt = Date.parse(draft.startsAt);
  const endsAt = Date.parse(draft.endsAt);
  if (
    !draft.startsAt ||
    !draft.endsAt ||
    !Number.isFinite(startsAt) ||
    !Number.isFinite(endsAt) ||
    startsAt >= endsAt
  ) {
    errors.push('بازه زمانی شروع و پایان معتبر و صعودی نیست.');
  }
  if (!/^\d+(?:\.\d{1,4})?$/.test(draft.budgetAmount)) {
    errors.push('بودجه باید Decimal غیرمنفی و بدون Float محاسباتی باشد.');
  }
  if (!draft.ownerUserId) errors.push('مسئول کمپین مشخص نیست.');
  if (!/^\d+(?:\.\d{1,4})?$/.test(draft.salesTarget))
    errors.push('هدف فروش باید Decimal غیرمنفی باشد.');
  if (
    !/^\d{1,3}(?:\.\d{1,4})?$/.test(draft.progressPercent) ||
    Number(draft.progressPercent) > 100
  )
    errors.push('پیشرفت هدف باید بین صفر تا صد باشد.');
  if (!/^\d+$/.test(draft.frequencyCap) || Number(draft.frequencyCap) < 1)
    errors.push('محدودیت تکرار باید یک عدد مثبت باشد.');
  for (const line of draft.spendLines) {
    if (!line.label.trim()) errors.push('عنوان هر ردیف هزینه الزامی است.');
    if (!/^\d+(?:\.\d{1,4})?$/.test(line.amount))
      errors.push('هزینه واقعی باید Decimal غیرمنفی باشد.');
  }
  return errors;
}

export function CampaignForm({
  campaign,
  mode,
  ownerUserId,
  segments,
  onSave,
}: CampaignFormProps) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CampaignDraft>(() =>
    campaignDraftFromPreview(campaign, ownerUserId),
  );
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const readOnly = mode === 'view';
  const errors = useMemo(() => validateDraft(draft), [draft]);

  const update = <Key extends keyof CampaignDraft>(
    key: Key,
    value: CampaignDraft[Key],
  ) => {
    setSubmitted(false);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const toggleChannel = (channel: CampaignChannel, checked: boolean) => {
    update(
      'channels',
      checked
        ? [...new Set([...draft.channels, channel])]
        : draft.channels.filter((item) => item !== channel),
    );
  };
  const updateSpend = (
    index: number,
    patch: Partial<CampaignDraft['spendLines'][number]>,
  ) =>
    update(
      'spendLines',
      draft.spendLines.map((line, current) =>
        current === index ? { ...line, ...patch } : line,
      ),
    );

  return (
    <div className="mt-5 grid gap-5" dir="rtl">
      <ol
        aria-label="مراحل فرم کمپین"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8"
      >
        {steps.map((label, index) => (
          <li key={label}>
            <button
              aria-current={step === index ? 'step' : undefined}
              className={`flex min-h-16 w-full flex-col items-start rounded-xl border p-2 text-start text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                step === index
                  ? 'border-primary bg-primary text-primary-foreground'
                  : index < step
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-border bg-muted/40 text-muted-foreground'
              }`}
              onClick={() => setStep(index)}
              type="button"
            >
              <span className="font-black">
                {(index + 1).toLocaleString('fa-IR')}
              </span>
              <span className="mt-1 leading-5">{label}</span>
            </button>
          </li>
        ))}
      </ol>

      <Card className="min-h-80 p-5">
        {step === 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <FormField id="campaign-code" label="کد داخلی" required>
              <Input
                id="campaign-code"
                dir="ltr"
                readOnly={readOnly}
                value={draft.internalCode}
                onChange={(event) =>
                  update('internalCode', event.target.value.toUpperCase())
                }
              />
            </FormField>
            <FormField id="campaign-name" label="نام کمپین" required>
              <Input
                id="campaign-name"
                readOnly={readOnly}
                value={draft.name}
                onChange={(event) => update('name', event.target.value)}
              />
            </FormField>
            <FormField id="campaign-type" label="نوع کمپین" required>
              <Input
                id="campaign-type"
                readOnly={readOnly}
                value={draft.campaignType}
                onChange={(event) => update('campaignType', event.target.value)}
              />
            </FormField>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4">
            <FormField
              id="campaign-objective"
              label="هدف قابل‌اندازه‌گیری کمپین"
              required
            >
              <Textarea
                id="campaign-objective"
                readOnly={readOnly}
                value={draft.objective}
                onChange={(event) => update('objective', event.target.value)}
              />
            </FormField>
            <FormField id="campaign-company" label="شرکت مجری" required>
              <Select
                disabled={readOnly}
                value={draft.company}
                onValueChange={(value) =>
                  update('company', value as ExecutionCompany)
                }
              >
                <SelectTrigger id="campaign-company">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(executionCompanyLabels).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </FormField>
            <div className="grid gap-2">
              <FormField id="campaign-owner" label="مسئول" required>
                <Input
                  id="campaign-owner"
                  dir="ltr"
                  readOnly
                  value={draft.ownerUserId}
                />
              </FormField>
              <p className="text-xs text-muted-foreground">
                فعلاً به کاربر جاری محدود است؛ انتخاب همکار پس از قرارداد عمومی
                IAM فعال می‌شود.
              </p>
            </div>
            <FormField id="campaign-sales-target" label="هدف فروش" required>
              <MoneyInput
                id="campaign-sales-target"
                readOnly={readOnly}
                value={draft.salesTarget}
                onValueChange={(salesTarget) =>
                  update('salesTarget', salesTarget)
                }
              />
            </FormField>
          </div>
        ) : null}

        {step === 2 ? (
          <fieldset disabled={readOnly}>
            <legend className="font-bold">کانال‌های کمپین</legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {selectableChannels.map((channel) => {
                const checked = draft.channels.includes(channel);
                return (
                  <label
                    className="flex min-h-12 items-center gap-3 rounded-xl border border-border p-3 text-sm"
                    key={channel}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        toggleChannel(channel, value === true)
                      }
                    />
                    <span>{campaignChannelLabels[channel]}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-4">
            <FormField id="campaign-segment" label="Segment مخاطب" required>
              <Select
                disabled={readOnly}
                value={draft.segmentReference || 'none'}
                onValueChange={(value) =>
                  update('segmentReference', value === 'none' ? '' : value)
                }
              >
                <SelectTrigger id="campaign-segment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون سگمنت</SelectItem>
                  {segments.map((segment) => (
                    <SelectItem key={segment.id} value={segment.id}>
                      {segment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <FormField id="campaign-starts-at" label="زمان شروع" required>
              <DatePicker
                id="campaign-starts-at"
                includeTime
                readOnly={readOnly}
                value={draft.startsAt}
                onChange={(value) => update('startsAt', value)}
              />
            </FormField>
            <FormField id="campaign-ends-at" label="زمان پایان" required>
              <DatePicker
                id="campaign-ends-at"
                includeTime
                readOnly={readOnly}
                value={draft.endsAt}
                onChange={(value) => update('endsAt', value)}
              />
            </FormField>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <FormField id="campaign-budget" label="بودجه مصوب" required>
              <MoneyInput
                id="campaign-budget"
                readOnly={readOnly}
                value={draft.budgetAmount}
                onValueChange={(budgetAmount) =>
                  update('budgetAmount', budgetAmount)
                }
              />
            </FormField>
            <FormField id="campaign-budget-currency" label="ارز بودجه" required>
              <Select
                disabled={readOnly}
                value={draft.budgetCurrencyCode}
                onValueChange={(value) =>
                  update('budgetCurrencyCode', value as MarketingCurrencyCode)
                }
              >
                <SelectTrigger id="campaign-budget-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IRR">IRR — ریال</SelectItem>
                  <SelectItem value="USD">USD — دلار</SelectItem>
                  <SelectItem value="EUR">EUR — یورو</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              id="campaign-target-currency"
              label="ارز هدف فروش"
              required
            >
              <Select
                disabled={readOnly}
                value={draft.targetCurrencyCode}
                onValueChange={(value) =>
                  update('targetCurrencyCode', value as MarketingCurrencyCode)
                }
              >
                <SelectTrigger id="campaign-target-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IRR">IRR — ریال</SelectItem>
                  <SelectItem value="USD">USD — دلار</SelectItem>
                  <SelectItem value="EUR">EUR — یورو</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            {mode === 'edit' ? (
              <>
                <FormField id="campaign-progress" label="پیشرفت هدف" required>
                  <Input
                    id="campaign-progress"
                    dir="ltr"
                    value={draft.progressPercent}
                    onChange={(event) =>
                      update('progressPercent', event.target.value)
                    }
                  />
                </FormField>
                <div className="grid gap-3 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <strong>ریز هزینه‌های اعلامی</strong>
                    <Button
                      aria-label="افزودن ردیف هزینه"
                      onClick={() =>
                        update('spendLines', [
                          ...draft.spendLines,
                          {
                            label: '',
                            amount: '',
                            currencyCode: draft.budgetCurrencyCode,
                          },
                        ])
                      }
                      size="icon"
                      title="افزودن ردیف هزینه"
                      type="button"
                      variant="outline"
                    >
                      <Plus aria-hidden="true" className="size-4" />
                    </Button>
                  </div>
                  {draft.spendLines.map((line, index) => (
                    <div
                      className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-[1fr_1fr_10rem_auto]"
                      key={line.id ?? `new-spend-${index}`}
                    >
                      <Input
                        aria-label={`عنوان هزینه ${index + 1}`}
                        value={line.label}
                        onChange={(event) =>
                          updateSpend(index, { label: event.target.value })
                        }
                      />
                      <MoneyInput
                        aria-label={`مبلغ هزینه ${index + 1}`}
                        value={line.amount}
                        onValueChange={(amount) =>
                          updateSpend(index, { amount })
                        }
                      />
                      <Select
                        value={line.currencyCode}
                        onValueChange={(currencyCode) =>
                          updateSpend(index, {
                            currencyCode: currencyCode as MarketingCurrencyCode,
                          })
                        }
                      >
                        <SelectTrigger aria-label={`ارز هزینه ${index + 1}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="IRR">IRR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        aria-label={`حذف ردیف هزینه ${index + 1}`}
                        onClick={() =>
                          update(
                            'spendLines',
                            draft.spendLines.filter(
                              (_, current) => current !== index,
                            ),
                          )
                        }
                        size="icon"
                        title="حذف ردیف"
                        type="button"
                        variant="destructive"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <FormField
                  id="campaign-links"
                  label="لینک‌ها (هر خط یک نشانی HTTP(S))"
                >
                  <Textarea
                    id="campaign-links"
                    rows={3}
                    value={draft.links}
                    onChange={(event) => update('links', event.target.value)}
                  />
                </FormField>
              </>
            ) : null}
          </div>
        ) : null}

        {step === 6 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <FormField id="campaign-utm-source" label="UTM Source">
              <Input
                id="campaign-utm-source"
                dir="ltr"
                readOnly={readOnly}
                value={draft.utmSource}
                onChange={(event) => update('utmSource', event.target.value)}
              />
            </FormField>
            <FormField id="campaign-utm-medium" label="UTM Medium">
              <Input
                id="campaign-utm-medium"
                dir="ltr"
                readOnly={readOnly}
                value={draft.utmMedium}
                onChange={(event) => update('utmMedium', event.target.value)}
              />
            </FormField>
            <FormField id="campaign-utm-campaign" label="UTM Campaign">
              <Input
                id="campaign-utm-campaign"
                dir="ltr"
                readOnly={readOnly}
                value={draft.utmCampaign}
                onChange={(event) => update('utmCampaign', event.target.value)}
              />
            </FormField>
            <FormField id="campaign-utm-term" label="UTM Term">
              <Input
                id="campaign-utm-term"
                dir="ltr"
                readOnly={readOnly}
                value={draft.utmTerm}
                onChange={(event) => update('utmTerm', event.target.value)}
              />
            </FormField>
            <FormField id="campaign-utm-content" label="UTM Content">
              <Input
                id="campaign-utm-content"
                dir="ltr"
                readOnly={readOnly}
                value={draft.utmContent}
                onChange={(event) => update('utmContent', event.target.value)}
              />
            </FormField>
            <FormField
              id="campaign-frequency-cap"
              label="محدودیت تکرار ارسال (تعداد)"
              required
            >
              <Input
                id="campaign-frequency-cap"
                readOnly={readOnly}
                value={draft.frequencyCap}
                onChange={(event) => update('frequencyCap', event.target.value)}
              />
            </FormField>
          </div>
        ) : null}

        {step === 7 ? (
          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="font-black">انتشار داخلی کمپین</h3>
                <p className="text-sm text-muted-foreground">
                  انتشار فقط وضعیت داخلی را فعال می‌کند و هیچ Provider یا
                  وب‌سایتی فراخوانی نمی‌شود.
                </p>
              </div>
            </div>
            <dl className="grid gap-3 rounded-2xl bg-muted/50 p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">کمپین</dt>
                <dd className="mt-1 font-bold">{draft.name || 'تکمیل نشده'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">کد</dt>
                <dd className="mt-1 font-bold" dir="ltr">
                  {draft.internalCode}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">شرکت</dt>
                <dd className="mt-1 font-bold">
                  {executionCompanyLabels[draft.company]}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">کانال‌ها</dt>
                <dd className="mt-1 font-bold">
                  {draft.channels
                    .map((channel) => campaignChannelLabels[channel])
                    .join('، ') || 'انتخاب نشده'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">بودجه</dt>
                <dd className="mt-1 font-bold" dir="ltr">
                  {draft.budgetAmount || '—'} {draft.budgetCurrencyCode}
                </dd>
              </div>
            </dl>
            {errors.length ? (
              <Alert
                tone="error"
                title={`${errors.length.toLocaleString('fa-IR')} مورد نیاز به اصلاح دارد`}
              >
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </Alert>
            ) : (
              <Alert title="اعتبارسنجی انتشار موفق" />
            )}
            {submitted ? (
              <Alert
                title={
                  mode === 'create' ? 'کمپین منتشر شد' : 'تغییرات ذخیره شد'
                }
              />
            ) : null}
            {saveError ? <Alert tone="error" title={saveError} /> : null}
          </div>
        ) : null}
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap gap-2">
          <Button
            aria-label="مرحله قبلی"
            disabled={step === 0}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            size="icon"
            title="مرحله قبلی"
            type="button"
            variant="outline"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
          {step < steps.length - 1 ? (
            <Button
              aria-label="مرحله بعدی"
              onClick={() =>
                setStep((current) => Math.min(steps.length - 1, current + 1))
              }
              size="icon"
              title="مرحله بعدی"
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
          ) : !readOnly ? (
            <Button
              aria-label={
                saving
                  ? 'در حال ذخیره کمپین'
                  : mode === 'create'
                    ? 'انتشار کمپین'
                    : 'ذخیره تغییرات کمپین'
              }
              disabled={errors.length > 0 || saving}
              onClick={async () => {
                setSaving(true);
                setSaveError('');
                try {
                  await onSave(draft);
                  setSubmitted(true);
                } catch (error) {
                  setSaveError(
                    error instanceof Error
                      ? error.message
                      : 'ذخیره کمپین انجام نشد.',
                  );
                } finally {
                  setSaving(false);
                }
              }}
              size="icon"
              title={mode === 'create' ? 'انتشار کمپین' : 'ذخیره تغییرات کمپین'}
              type="button"
            >
              <Send aria-hidden="true" className="size-4" />
            </Button>
          ) : (
            <Badge className="gap-1">
              <Check aria-hidden="true" className="size-3.5" />
              حالت فقط مشاهده
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
