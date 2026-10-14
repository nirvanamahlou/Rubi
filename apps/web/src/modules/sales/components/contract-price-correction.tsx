'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { MoneyInput } from '@/components/ui/money-input';
import { salesApi, SalesApiError } from '../api/client';
export function ContractPriceCorrection({
  contractId,
  onSaved,
  refreshVersion = 0,
}: {
  contractId: string;
  onSaved: () => void;
  refreshVersion?: number;
}) {
  const [form, setForm] = useState<{
    version: number;
    totals: { currencyCode: string; amount: string }[];
  } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let live = true;
    void salesApi
      .priceCorrection(contractId)
      .then((result) => {
        if (live) {
          setSaved(false);
          setReason('');
          setForm({
            ...result,
            totals: [
              ...(!result.totals.some((t) => t.currencyCode === 'IRR')
                ? [{ currencyCode: 'IRR', amount: '0' }]
                : []),
              ...result.totals,
              ...(!result.totals.some((t) => t.currencyCode !== 'IRR')
                ? [{ currencyCode: 'USD', amount: '0' }]
                : []),
            ],
          });
        }
      })
      .catch((e: unknown) => {
        if (live && !(e instanceof SalesApiError && e.status === 403))
          setError(
            e instanceof Error
              ? e.message
              : 'دریافت مشخصات قرارداد ناموفق بود.',
          );
      });
    return () => {
      live = false;
    };
  }, [contractId, refreshVersion]);
  if (!form) return error ? <p role="alert">{error}</p> : null;
  async function save() {
    if (!form || busy || saved) return;
    setBusy(true);
    setError('');
    try {
      const result = await salesApi.correctPrice(contractId, {
        expectedVersion: form.version,
        totals: form.totals,
        reason,
      });
      setForm(result);
      setSaved(true);
      window.dispatchEvent(new Event('reservation-workflow-changed'));
      try {
        localStorage.setItem(
          'rubi-contract-price-updated',
          crypto.randomUUID(),
        );
      } catch {
        /* Storage may be disabled; the inbox also polls current prices. */
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت اصلاح ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="grid gap-3 rounded-xl border p-3">
      <h3 className="font-bold">تغییر مبلغ کل قرارداد</h3>
      <fieldset disabled={busy || saved} className="grid gap-3 md:grid-cols-2">
        {form.totals.map((total, index) => (
          <label className="grid gap-2" key={index}>
            {total.currencyCode === 'IRR' ? 'مبلغ کل ریالی' : 'مبلغ کل ارزی'} (
            {total.currencyCode})
            <MoneyInput
              value={total.amount}
              onValueChange={(amount) =>
                setForm({
                  ...form,
                  totals: form.totals.map((t, i) =>
                    i === index ? { ...t, amount } : t,
                  ),
                })
              }
            />
          </label>
        ))}
        <label className="grid gap-2 md:col-span-2">
          دلیل اصلاح قرارداد
          <Input
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </fieldset>
      <Button
        disabled={busy || saved || !reason.trim()}
        onClick={() => void save()}
      >
        {busy ? 'در حال ثبت…' : saved ? 'ثبت شد' : 'ثبت مبلغ کل قرارداد'}
      </Button>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
