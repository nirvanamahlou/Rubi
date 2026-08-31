'use client';

import type {
  MasterCurrencyRateRecord,
  MasterDataRecord,
  MasterDataStatus,
} from '@rubi/contracts';
import { ArrowLeftRight, Coins, Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import { Alert, Badge, Card } from '@/components/ui/surfaces';
import { masterDataApi } from '../api/client';
import { getMasterDataDefinition } from '../model/catalog';
import {
  currencyFormValues,
  persistCurrencyForm,
  validateCurrencyForm,
  validateCurrencyQuote,
} from '../model/currency-form';
import { MasterDataProfileDialog } from './master-data-profile-dialog';
import { MasterDataReferenceSelector } from './master-data-reference-selector';
import { MasterDataClearableField } from './master-data-clearable-field';

const currencyDefinition = getMasterDataDefinition('currencies');

export function MasterDataCurrencyForm({
  record,
  onOpenChange,
  onSaved,
}: {
  record?: MasterDataRecord;
  onOpenChange: (open: boolean) => void;
  onSaved: (record: MasterDataRecord) => void;
}) {
  const [saved, setSaved] = useState(record);
  const [values, setValues] = useState(() => currencyFormValues(record));
  const [status, setStatus] = useState<MasterDataStatus | ''>(
    record?.status ?? 'active',
  );
  const [rateValues, setRateValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rateErrors, setRateErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [submittedRates, setSubmittedRates] = useState<
    readonly MasterCurrencyRateRecord[]
  >([]);
  const recordSaved = (next: MasterDataRecord) => {
    setSaved(next);
    onSaved(next);
  };

  async function saveCurrency(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const validated = validateCurrencyForm(values, status);
    setErrors(validated.errors);
    setNotice('');
    if (!validated.success || !status) return;
    setSaving(true);
    try {
      await persistCurrencyForm(masterDataApi, {
        ...(saved ? { record: saved } : {}),
        values: validated.values,
        status,
        onSaved: recordSaved,
      });
      setValues(validated.values);
      setNotice(
        'مشخصات ارز ذخیره شد. نرخ جدید را می‌توانید در بخش پایین همین فرم ثبت کنید.',
      );
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : 'ذخیره ارز ناموفق بود.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveQuote(event: FormEvent) {
    event.preventDefault();
    if (saving || !saved || saved.status !== 'active') return;
    const validated = validateCurrencyQuote(saved.code, rateValues);
    setRateErrors(validated.errors);
    setNotice('');
    if (!validated.success) return;
    setSaving(true);
    try {
      const response = await masterDataApi.createCurrencyQuote(validated.input);
      setSubmittedRates(response.data);
      setRateValues((current) => ({
        ...current,
        buyRate: '',
        sellRate: '',
        correctionReason: '',
      }));
      setNotice(
        'نرخ‌ها به‌صورت پیش‌نویس جدید در تاریخچه ثبت شدند و برای تأیید ارسال می‌شوند.',
      );
      onSaved(saved);
    } catch (error) {
      setRateErrors({
        form: error instanceof Error ? error.message : 'ثبت نرخ ناموفق بود.',
      });
    } finally {
      setSaving(false);
    }
  }

  const updateRate = (key: string, value: string) =>
    setRateValues((current) => ({ ...current, [key]: value }));

  return (
    <MasterDataProfileDialog
      open
      onOpenChange={(open) => {
        if (!saving) onOpenChange(open);
      }}
      title={saved ? `ویرایش ارز ${saved.code}` : 'تعریف ارز'}
      description="مشخصات ارز و ثبت نرخ خرید و فروش؛ نرخ‌ها در تاریخچه مستقل نگهداری می‌شوند."
    >
      <div className="space-y-5">
        {notice ? <Alert title="نتیجه عملیات" description={notice} /> : null}
        <Card className="p-5">
          <h2 className="mb-5 flex items-center gap-2 font-black">
            <Coins className="size-5" /> مشخصات ارز
          </h2>
          <form
            onSubmit={(event) => void saveCurrency(event)}
            className="space-y-5"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {currencyDefinition.fields.map((field) => {
                const id = `currency-${field.key}`;
                return (
                  <FormField
                    key={field.key}
                    id={id}
                    label={field.key === 'name' ? 'نام فارسی ارز' : field.label}
                    {...(field.required ? { required: true } : {})}
                    {...(errors[field.key] ? { error: errors[field.key] } : {})}
                  >
                    <Input
                      id={id}
                      disabled={saving}
                      value={values[field.key] ?? ''}
                      aria-invalid={Boolean(errors[field.key])}
                      dir={
                        ['code', 'englishName'].includes(field.key)
                          ? 'ltr'
                          : undefined
                      }
                      inputMode={
                        field.type === 'number' ? 'numeric' : undefined
                      }
                      type={field.type === 'number' ? 'number' : 'text'}
                      {...(field.key === 'decimalDigits'
                        ? { min: 0, max: 6, step: 1 }
                        : {})}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                    />
                  </FormField>
                );
              })}
              <FormField
                id="currency-status"
                label="وضعیت ارز"
                required
                {...(errors.status ? { error: errors.status } : {})}
              >
                <MasterDataClearableField
                  controlId="currency-status"
                  label="وضعیت ارز"
                  value={status}
                  onClear={() => setStatus('')}
                  disabled={saving}
                >
                  <Select
                    disabled={saving}
                    value={status}
                    onValueChange={(value) => {
                      if (
                        value === 'active' ||
                        value === 'inactive' ||
                        value === ''
                      )
                        setStatus(value);
                    }}
                  >
                    <SelectTrigger
                      id="currency-status"
                      aria-invalid={Boolean(errors.status)}
                      aria-describedby={
                        errors.status ? 'currency-status-error' : undefined
                      }
                    >
                      <SelectValue placeholder="انتخاب کنید" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">فعال</SelectItem>
                      <SelectItem value="inactive">غیرفعال</SelectItem>
                    </SelectContent>
                  </Select>
                </MasterDataClearableField>
              </FormField>
              <FormField
                id="currency-base"
                label="ارز پایه"
                description="ارز پایه به‌ازای شرکت در ماژول مالی تعیین می‌شود؛ قرارداد آن هنوز متصل نیست."
              >
                <Input
                  id="currency-base"
                  readOnly
                  value="نامشخص — در انتظار اتصال مالی"
                />
              </FormField>
            </div>
            {errors.form ? (
              <Alert
                title="ذخیره کامل نشد"
                description={errors.form}
                tone="error"
              />
            ) : null}
            <div className="flex items-center justify-between gap-3">
              {saved ? (
                <Badge>نسخه {saved.version.toLocaleString('fa-IR')}</Badge>
              ) : (
                <span />
              )}
              <Button type="submit" loading={saving}>
                <Save className="size-4" /> ذخیره مشخصات ارز
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="mb-2 flex items-center gap-2 font-black">
            <ArrowLeftRight className="size-5" /> ثبت نرخ خرید و فروش
          </h2>
          <p className="mb-5 text-sm leading-7 text-muted-foreground">
            هر ثبت، نرخ جدید می‌سازد و تاریخچه قبلی را تغییر نمی‌دهد. نرخ‌ها
            دستی و غیرقطعی مالی‌اند؛ تأیید فقط توسط کاربر مجاز دیگری انجام
            می‌شود.
          </p>
          {!saved || saved.status !== 'active' ? (
            <Alert
              title="ابتدا ارز را ذخیره و فعال کنید"
              description="ثبت نرخ برای ارز ذخیره‌نشده یا غیرفعال امکان‌پذیر نیست."
            />
          ) : null}
          <form
            onSubmit={(event) => void saveQuote(event)}
            className="mt-4 space-y-4"
          >
            <fieldset
              disabled={saving || !saved || saved.status !== 'active'}
              className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <legend className="sr-only">اطلاعات نرخ ارز جدید</legend>
              <FormField id="quote-currency" label="ارز">
                <Input
                  id="quote-currency"
                  readOnly
                  value={
                    saved ? `${saved.name} (${saved.code})` : 'پس از ذخیره ارز'
                  }
                />
              </FormField>
              <FormField
                id="quote-target"
                label="ارز مقابل نرخ"
                required
                {...(rateErrors.toCurrencyCode
                  ? { error: rateErrors.toCurrencyCode }
                  : {})}
              >
                <MasterDataReferenceSelector
                  config={{ target: 'currencies', payload: 'code' }}
                  id="quote-target"
                  label="ارز مقابل نرخ"
                  disabled={saving || !saved || saved.status !== 'active'}
                  value={rateValues.toCurrencyCode ?? ''}
                  onChange={(value) => updateRate('toCurrencyCode', value)}
                />
              </FormField>
              {(['buyRate', 'sellRate', 'source'] as const).map((key) => (
                <FormField
                  id={`quote-${key}`}
                  key={key}
                  label={
                    key === 'buyRate'
                      ? 'نرخ خرید'
                      : key === 'sellRate'
                        ? 'نرخ فروش'
                        : 'منبع'
                  }
                  {...(key === 'source' ? { required: true } : {})}
                  {...(rateErrors[key] ? { error: rateErrors[key] } : {})}
                >
                  <Input
                    id={`quote-${key}`}
                    aria-invalid={Boolean(rateErrors[key])}
                    value={rateValues[key] ?? ''}
                    {...(key === 'source'
                      ? { maxLength: 160 }
                      : ({
                          dir: 'ltr',
                          inputMode: 'decimal',
                          maxLength: 25,
                        } as const))}
                    onChange={(event) => updateRate(key, event.target.value)}
                  />
                </FormField>
              ))}
              {(['observedAt', 'validFrom', 'validTo'] as const).map((key) => (
                <FormField
                  id={`quote-${key}`}
                  key={key}
                  label={
                    key === 'observedAt'
                      ? 'تاریخ و ساعت'
                      : key === 'validFrom'
                        ? 'شروع اعتبار (اختیاری)'
                        : 'پایان اعتبار (اختیاری)'
                  }
                  {...(key === 'observedAt'
                    ? {
                        required: true,
                        description: 'انتخاب به وقت محلی؛ ذخیره با UTC.',
                      }
                    : {})}
                  {...(rateErrors[key] ? { error: rateErrors[key] } : {})}
                >
                  <MasterDataClearableField
                    controlId={`quote-${key}`}
                    label={
                      key === 'observedAt'
                        ? 'تاریخ و ساعت'
                        : key === 'validFrom'
                          ? 'شروع اعتبار'
                          : 'پایان اعتبار'
                    }
                    value={rateValues[key] ?? ''}
                    onClear={() => updateRate(key, '')}
                    disabled={saving || !saved || saved.status !== 'active'}
                  >
                    <DatePicker
                      id={`quote-${key}`}
                      includeTime
                      disabled={saving || !saved || saved.status !== 'active'}
                      aria-invalid={Boolean(rateErrors[key])}
                      value={rateValues[key] ?? ''}
                      onChange={(value) => updateRate(key, value)}
                    />
                  </MasterDataClearableField>
                </FormField>
              ))}
              <FormField id="quote-maker" label="ثبت‌کننده">
                <Input
                  id="quote-maker"
                  readOnly
                  value="کاربر واردشده — ثبت خودکار توسط سامانه"
                />
              </FormField>
              <FormField id="quote-status" label="وضعیت نرخ">
                <Input
                  id="quote-status"
                  readOnly
                  value="پیش‌نویس — در انتظار تأیید"
                />
              </FormField>
              <FormField
                id="quote-correction"
                label="توضیح اصلاح (اختیاری)"
                {...(rateErrors.correctionReason
                  ? { error: rateErrors.correctionReason }
                  : {})}
              >
                <Input
                  id="quote-correction"
                  maxLength={500}
                  value={rateValues.correctionReason ?? ''}
                  onChange={(event) =>
                    updateRate('correctionReason', event.target.value)
                  }
                />
              </FormField>
            </fieldset>
            {rateErrors.form ? (
              <Alert
                title="ثبت نرخ انجام نشد"
                description={rateErrors.form}
                tone="error"
              />
            ) : null}
            <div className="flex justify-end">
              <Button
                type="submit"
                loading={saving}
                disabled={!saved || saved.status !== 'active'}
              >
                ثبت نرخ جدید در تاریخچه
              </Button>
            </div>
          </form>
          {submittedRates.length ? (
            <div className="mt-5 overflow-x-auto">
              <h3 className="mb-3 font-bold">نرخ‌های ثبت‌شده در این فرم</h3>
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr>
                    {[
                      'ارز',
                      'نوع',
                      'نرخ',
                      'منبع',
                      'تاریخ و ساعت',
                      'ثبت‌کننده',
                      'وضعیت',
                    ].map((label) => (
                      <th className="p-2 text-start" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {submittedRates.map((rate) => (
                    <tr key={rate.id} className="border-t">
                      <td className="p-2" dir="ltr">
                        {rate.fromCurrencyCode}/{rate.toCurrencyCode}
                      </td>
                      <td className="p-2">
                        {rate.rateType === 'BUY' ? 'خرید' : 'فروش'}
                      </td>
                      <td className="p-2" dir="ltr">
                        {rate.rate}
                      </td>
                      <td className="p-2">{rate.source}</td>
                      <td className="p-2">
                        {new Date(rate.observedAt).toLocaleString('fa-IR')}
                      </td>
                      <td className="p-2 font-mono text-xs" dir="ltr">
                        {rate.createdByUserId}
                      </td>
                      <td className="p-2">
                        <Badge>پیش‌نویس</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
        <div className="flex justify-end">
          <Button
            disabled={saving}
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            بستن
          </Button>
        </div>
      </div>
    </MasterDataProfileDialog>
  );
}
