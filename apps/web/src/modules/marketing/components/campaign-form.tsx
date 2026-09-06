'use client';

import { Check, ChevronLeft, ChevronRight, Eye, Save } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
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
  marketingSegments,
  type CampaignChannel,
  type CampaignPreview,
  type ExecutionCompany,
} from '../model/marketing';

export type CampaignFormMode = 'create' | 'view' | 'edit';

interface CampaignFormProps {
  mode: CampaignFormMode;
  campaign?: CampaignPreview | undefined;
}

const steps = [
  'مشخصات پایه',
  'هدف و شرکت',
  'کانال‌ها',
  'مخاطب',
  'زمان‌بندی',
  'بودجه',
  'ردیابی و ارسال',
  'تایید و پیش‌نمایش',
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

interface CampaignDraft {
  internalCode: string;
  name: string;
  campaignType: string;
  objective: string;
  company: ExecutionCompany;
  channels: CampaignChannel[];
  segmentReference: string;
  startsAt: string;
  endsAt: string;
  budgetAmount: string;
  currencyCode: 'IRR' | 'USD' | 'EUR';
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  frequencyCap: string;
  expectedVersion: number;
}

function initialDraft(campaign?: CampaignPreview): CampaignDraft {
  return {
    internalCode: campaign?.internalCode ?? 'MKT-PREVIEW-NEW',
    name: campaign?.name ?? '',
    campaignType: campaign?.campaignType ?? 'فروش فصلی',
    objective: campaign?.objective ?? '',
    company: campaign?.executionCompany ?? 'NIAYESH_SEIR_SAHAR',
    channels: campaign ? [...campaign.channels] : ['WEBSITE'],
    segmentReference: campaign?.segmentReference ?? marketingSegments[0].id,
    startsAt: campaign?.startsAt ?? '',
    endsAt: campaign?.endsAt ?? '',
    budgetAmount: campaign?.budgetAmount ?? '',
    currencyCode: campaign?.currencyCode ?? 'IRR',
    utmSource: 'rubi-preview',
    utmMedium: 'campaign-workspace',
    utmCampaign: campaign?.utmCampaign ?? '',
    frequencyCap: campaign?.frequencyCap ?? 'حداکثر ۱ پیام در ۷ روز',
    expectedVersion: campaign?.version ?? 1,
  };
}

function validateDraft(draft: CampaignDraft): string[] {
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
  if (!draft.segmentReference.startsWith('preview-'))
    errors.push('فقط Segment ساختگی مجاز است.');
  if (
    !draft.startsAt ||
    !draft.endsAt ||
    Date.parse(draft.startsAt) >= Date.parse(draft.endsAt)
  ) {
    errors.push('بازه زمانی شروع و پایان معتبر و صعودی نیست.');
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(draft.budgetAmount)) {
    errors.push('بودجه باید Decimal غیرمنفی و بدون Float محاسباتی باشد.');
  }
  if (!draft.utmCampaign.trim()) errors.push('UTM Campaign الزامی است.');
  return errors;
}

export function CampaignForm({ campaign, mode }: CampaignFormProps) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CampaignDraft>(() =>
    initialDraft(campaign),
  );
  const [submitted, setSubmitted] = useState(false);
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
                value={draft.segmentReference}
                onValueChange={(value) => update('segmentReference', value)}
              >
                <SelectTrigger id="campaign-segment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {marketingSegments.map((segment) => (
                    <SelectItem key={segment.id} value={segment.id}>
                      {segment.title}
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
              <Input
                id="campaign-budget"
                dir="ltr"
                inputMode="decimal"
                readOnly={readOnly}
                value={draft.budgetAmount}
                onChange={(event) => update('budgetAmount', event.target.value)}
              />
            </FormField>
            <FormField id="campaign-currency" label="کد ارز" required>
              <Select
                disabled={readOnly}
                value={draft.currencyCode}
                onValueChange={(value) =>
                  update('currencyCode', value as CampaignDraft['currencyCode'])
                }
              >
                <SelectTrigger id="campaign-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IRR">IRR — ریال</SelectItem>
                  <SelectItem value="USD">USD — دلار</SelectItem>
                  <SelectItem value="EUR">EUR — یورو</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
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
            <FormField id="campaign-utm-campaign" label="UTM Campaign" required>
              <Input
                id="campaign-utm-campaign"
                dir="ltr"
                readOnly={readOnly}
                value={draft.utmCampaign}
                onChange={(event) => update('utmCampaign', event.target.value)}
              />
            </FormField>
            <FormField
              id="campaign-frequency-cap"
              label="محدودیت تکرار ارسال"
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
              <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Eye aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h3 className="font-black">پیش‌نمایش نهایی</h3>
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
                  {draft.budgetAmount || '—'} {draft.currencyCode}
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
              <Alert title="اعتبارسنجی پیش‌نمایش موفق" />
            )}
            {submitted ? <Alert title="پیش‌نویس آماده شد" /> : null}
          </div>
        ) : null}
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={step === 0}
            onClick={() => setStep((current) => Math.max(0, current - 1))}
            type="button"
            variant="outline"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
            قبلی
          </Button>
          {step < steps.length - 1 ? (
            <Button
              onClick={() =>
                setStep((current) => Math.min(steps.length - 1, current + 1))
              }
              type="button"
            >
              بعدی
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
          ) : !readOnly ? (
            <Button
              disabled={errors.length > 0}
              onClick={() => setSubmitted(true)}
              type="button"
            >
              <Save aria-hidden="true" className="size-4" />
              آماده‌سازی پیش‌نویس
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
