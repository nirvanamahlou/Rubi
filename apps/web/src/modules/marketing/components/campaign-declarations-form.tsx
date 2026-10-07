'use client';

import { useRef, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import type { MarketingCampaignInputV1 } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import {
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui/form-controls';
import {
  campaignDraftFromPreview,
  campaignInputFromDraft,
  sumSpendByCurrency,
  type CampaignDraft,
  type MarketingCurrencyCode,
} from '../model/durable-records';
import type { CampaignPreview } from '../model/marketing';
export function validateDeclarations(
  draft: Pick<CampaignDraft, 'progressPercent' | 'spendLines' | 'links'>,
): string[] {
  const errors: string[] = [];
  if (
    !/^\d{1,3}(?:\.\d{1,4})?$/.test(draft.progressPercent) ||
    Number(draft.progressPercent) > 100
  )
    errors.push('پیشرفت هدف باید بین صفر تا صد باشد.');
  if (draft.spendLines.length > 100)
    errors.push('حداکثر ۱۰۰ ردیف هزینه مجاز است.');
  for (const line of draft.spendLines) {
    if (!line.label.trim() || line.label.trim().length > 160)
      errors.push('عنوان هر هزینه باید بین ۱ تا ۱۶۰ نویسه باشد.');
    if (!/^\d{1,20}(?:\.\d{1,4})?$/.test(line.amount))
      errors.push('مبلغ هزینه باید عدد غیرمنفی با حداکثر چهار رقم اعشار باشد.');
    if (!['IRR', 'USD', 'EUR'].includes(line.currencyCode))
      errors.push('ارز هزینه معتبر نیست.');
  }
  const links = draft.links
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    links.length > 30 ||
    links.some((value) => {
      try {
        const url = new URL(value);
        return (
          !['http:', 'https:'].includes(url.protocol) || value.length > 2048
        );
      } catch {
        return true;
      }
    })
  )
    errors.push('حداکثر ۳۰ لینک معتبر HTTP یا HTTPS وارد کنید.');
  return errors;
}

export function campaignDeclarationsInput(
  campaign: CampaignPreview,
  draft: CampaignDraft,
): MarketingCampaignInputV1 {
  const original = campaignDraftFromPreview(
    campaign,
    campaign.ownerUserId ?? '',
  );
  return campaignInputFromDraft(
    {
      ...original,
      progressPercent: draft.progressPercent,
      spendLines: draft.spendLines.map(({ label, amount, currencyCode }) => ({
        label: label.trim(),
        amount,
        currencyCode,
      })),
      links: draft.links,
    },
    campaign,
  );
}

export function CampaignDeclarationsForm({
  campaign,
  onSave,
}: {
  campaign: CampaignPreview;
  onSave: (input: MarketingCampaignInputV1, key: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() =>
    campaignDraftFromPreview(campaign, campaign.ownerUserId ?? ''),
  );
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const attempt = useRef<{
    input: MarketingCampaignInputV1;
    key: string;
  } | null>(null);
  const totals = draft.spendLines.every((line) =>
    /^\d{1,20}(?:\.\d{1,4})?$/.test(line.amount),
  )
    ? sumSpendByCurrency(draft.spendLines)
    : [];
  return (
    <form
      className="grid gap-4 text-right"
      dir="rtl"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        const errors = validateDeclarations(draft);
        if (errors.length) {
          setError(errors.join(' '));
          return;
        }
        attempt.current ??= {
          input: campaignDeclarationsInput(campaign, draft),
          key: crypto.randomUUID(),
        };
        setPending(true);
        setFrozen(true);
        setError('');
        try {
          await onSave(attempt.current.input, attempt.current.key);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'ذخیره انجام نشد.');
        } finally {
          setPending(false);
        }
      }}
    >
      <FormField id="declarations-progress" label="پیشرفت هدف (درصد)" required>
        <Input
          id="declarations-progress"
          dir="ltr"
          disabled={frozen}
          value={draft.progressPercent}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              progressPercent: event.target.value,
            }))
          }
        />
      </FormField>
      <section className="grid gap-3 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">ریز هزینه‌ها</h3>
          <Button
            type="button"
            size="icon"
            variant="outline"
            title="افزودن هزینه"
            aria-label="افزودن هزینه"
            disabled={frozen || draft.spendLines.length >= 100}
            onClick={() =>
              setDraft((current) => ({
                ...current,
                spendLines: [
                  ...current.spendLines,
                  {
                    label: '',
                    amount: '',
                    currencyCode: current.budgetCurrencyCode,
                  },
                ],
              }))
            }
          >
            <Plus aria-hidden="true" className="size-4" />
          </Button>
        </div>
        {draft.spendLines.map((line, index) => (
          <div
            key={index}
            className="grid items-end gap-3 md:grid-cols-[1fr_1fr_9rem_auto]"
          >
            <FormField
              id={`expense-title-${index}`}
              label="عنوان هزینه"
              required
            >
              <Input
                id={`expense-title-${index}`}
                disabled={frozen}
                value={line.label}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    spendLines: current.spendLines.map((item, i) =>
                      i === index
                        ? { ...item, label: event.target.value }
                        : item,
                    ),
                  }))
                }
              />
            </FormField>
            <FormField id={`expense-amount-${index}`} label="مبلغ" required>
              <MoneyInput
                id={`expense-amount-${index}`}
                disabled={frozen}
                value={line.amount}
                onValueChange={(amount) =>
                  setDraft((current) => ({
                    ...current,
                    spendLines: current.spendLines.map((item, i) =>
                      i === index ? { ...item, amount } : item,
                    ),
                  }))
                }
              />
            </FormField>
            <FormField id={`expense-currency-${index}`} label="ارز" required>
              <Select
                disabled={frozen}
                value={line.currencyCode}
                onValueChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    spendLines: current.spendLines.map((item, i) =>
                      i === index
                        ? {
                            ...item,
                            currencyCode: value as MarketingCurrencyCode,
                          }
                        : item,
                    ),
                  }))
                }
              >
                <SelectTrigger id={`expense-currency-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IRR">ریال</SelectItem>
                  <SelectItem value="USD">دلار</SelectItem>
                  <SelectItem value="EUR">یورو</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <Button
              type="button"
              size="icon"
              variant="outline"
              disabled={frozen}
              aria-label={`حذف هزینه ${index + 1}`}
              title="حذف هزینه"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  spendLines: current.spendLines.filter((_, i) => i !== index),
                }))
              }
            >
              <Trash2 aria-hidden="true" className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
        <div aria-live="polite">
          <strong>هزینه واقعی</strong>
          <p dir="ltr">
            {totals
              .map((total) => `${total.amount} ${total.currencyCode}`)
              .join(' + ') || '۰'}
          </p>
        </div>
      </section>
      <FormField id="declarations-links" label="لینک‌ها (هر لینک در یک خط)">
        <Textarea
          id="declarations-links"
          dir="ltr"
          disabled={frozen}
          value={draft.links}
          onChange={(event) =>
            setDraft((current) => ({ ...current, links: event.target.value }))
          }
        />
      </FormField>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
          {frozen
            ? ' برای تلاش مجدد همان داده‌ها ارسال می‌شوند؛ برای اصلاح، فرم را ببندید و دوباره باز کنید.'
            : ''}
        </p>
      ) : null}
      <Button
        type="submit"
        size="icon"
        disabled={pending}
        aria-label="ثبت جزئیات کمپین"
        title={pending ? 'در حال ثبت' : 'ثبت جزئیات کمپین'}
      >
        <Save aria-hidden="true" className="size-4" />
      </Button>
    </form>
  );
}
