'use client';

import type { MasterCurrencyRateRecord } from '@nora/contracts';
import { FilePenLine, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import { masterDataApi } from '../api/client';
import { MasterDataNumberInput } from './master-data-number-input';

type Rate = Pick<
  MasterCurrencyRateRecord,
  | 'id'
  | 'rate'
  | 'source'
  | 'version'
  | 'fromCurrencyCode'
  | 'toCurrencyCode'
  | 'rateType'
  | 'observedAt'
>;

// Decimal JSON may use scientific notation; expand without floating-point rounding.
export function editableCurrencyRate(value: string): string {
  const match = /^(\d+)(?:\.(\d+))?e([+-]?\d+)$/i.exec(value);
  if (!match) return value;
  const exponent = Number(match[3]);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 24) return value;
  const digits = match[1] + (match[2] ?? '');
  const point = match[1].length + exponent;
  if (point <= 0) return `0.${'0'.repeat(-point)}${digits}`;
  if (point >= digits.length) return digits + '0'.repeat(point - digits.length);
  return `${digits.slice(0, point)}.${digits.slice(point)}`;
}

export function CurrencyRateActions({
  record,
  onSaved,
}: {
  record: Rate;
  onSaved: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<'edit' | 'delete' | null>(null);
  const [target, setTarget] = useState(record);
  const [rate, setRate] = useState(editableCurrencyRate(record.rate));
  const [source, setSource] = useState(record.source);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  function open(next: 'edit' | 'delete') {
    if (busy.current) return;
    setTarget({ ...record });
    setRate(editableCurrencyRate(record.rate));
    setSource(record.source);
    setError('');
    setMode(next);
  }
  async function save() {
    if (busy.current || !mode) return;
    if (
      mode === 'edit' &&
      (!/^\d{1,14}(\.\d{1,10})?$/.test(rate) || !/[1-9]/.test(rate))
    ) {
      setError('مقدار نرخ معتبر نیست.');
      return;
    }
    busy.current = true;
    setPending(true);
    setError('');
    try {
      if (mode === 'edit')
        await masterDataApi.updateCurrencyRate(target.id, {
          expectedVersion: target.version,
          rate,
          source,
        });
      else await masterDataApi.removeCurrencyRate(target.id, target.version);
      setMode(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'عملیات ناموفق بود.');
      return;
    } finally {
      busy.current = false;
      setPending(false);
    }
    await onSaved();
  }
  return (
    <>
      <Button
        aria-label="ویرایش نرخ ارز"
        title="ویرایش نرخ ارز"
        size="icon"
        variant="outline"
        onClick={() => open('edit')}
        disabled={pending}
      >
        <FilePenLine aria-hidden="true" className="size-4" />
      </Button>
      <Button
        aria-label="حذف نرخ ارز"
        title="حذف نرخ ارز"
        size="icon"
        variant="destructive"
        onClick={() => open('delete')}
        disabled={pending}
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </Button>
      <Dialog
        open={mode !== null}
        onOpenChange={(value) => {
          if (!value && !busy.current) setMode(null);
        }}
      >
        <DialogContent dir="rtl" aria-busy={pending}>
          <DialogTitle>
            {mode === 'edit' ? 'ویرایش نرخ ارز' : 'حذف نرخ ارز'}
          </DialogTitle>
          <DialogDescription>
            <span className="mb-1 block font-mono" dir="ltr">
              {target.fromCurrencyCode}/{target.toCurrencyCode} · {target.rate}
            </span>
            <span className="mb-2 block">
              {target.rateType === 'BUY'
                ? 'خرید'
                : target.rateType === 'SELL'
                  ? 'فروش'
                  : 'مرجع'}{' '}
              ·{' '}
              {new Date(target.observedAt).toLocaleString('fa-IR', {
                timeZone: 'Asia/Tehran',
              })}
            </span>
            {mode === 'delete'
              ? 'نرخ از فهرست و نمودار حذف می‌شود و سابقه عملیات باقی می‌ماند.'
              : null}
          </DialogDescription>
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            {mode === 'edit' ? (
              <>
                <FormField id={`rate-edit-${target.id}`} label="نرخ" required>
                  <MasterDataNumberInput
                    id={`rate-edit-${target.id}`}
                    value={rate}
                    onChange={setRate}
                    disabled={pending}
                    dir="ltr"
                  />
                </FormField>
                <FormField id={`rate-source-${target.id}`} label="منبع">
                  <Input
                    id={`rate-source-${target.id}`}
                    value={source}
                    maxLength={160}
                    onChange={(event) => setSource(event.target.value)}
                    disabled={pending}
                  />
                </FormField>
              </>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMode(null)}
                disabled={pending}
              >
                انصراف
              </Button>
              <Button
                type="submit"
                loading={pending}
                variant={mode === 'delete' ? 'destructive' : 'primary'}
              >
                {mode === 'delete' ? 'حذف' : 'ذخیره'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
