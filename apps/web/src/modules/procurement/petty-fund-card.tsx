'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { MoneyInput } from '@/components/ui/money-input';
import { Alert } from '@/components/ui/surfaces';
import { procurementRequest, type Bootstrap } from './api';
import { ProcurementSelect } from './procurement-select';
type Fund = {
  balance: string;
  currencyCode: string;
  bankName: string;
  accountNumber: string;
  iban: string;
  cardNumber: string;
  version: number;
};
const empty: Fund = {
  balance: '0',
  currencyCode: 'IRR',
  bankName: '',
  accountNumber: '',
  iban: '',
  cardNumber: '',
  version: 0,
};
export function pettyBalanceLabel(value: string) {
  const [whole, fraction] = value.split('.');
  return (
    whole!.replace(/\B(?=(\d{3})+(?!\d))/g, '٬') +
    (fraction ? '٫' + fraction : '')
  ).replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]!);
}
export function PettyFundCard({ bootstrap }: { bootstrap: Bootstrap }) {
  const client = useQueryClient();
  const [branchId, setBranch] = useState(
    bootstrap.defaultBranchId ?? bootstrap.branches[0]?.id ?? '',
  );
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [draft, setDraft] = useState<Fund>(empty);
  const query = useQuery({
    queryKey: ['procurement', 'petty-fund', branchId],
    queryFn: () =>
      procurementRequest<Fund | null>(
        `/petty-fund?branchId=${encodeURIComponent(branchId)}`,
      ),
    enabled: Boolean(branchId),
  });
  const editable = bootstrap.permissions.includes('procurement.assign');
  return (
    <>
      <button
        type="button"
        className="min-h-40 rounded-2xl border border-emerald-300 bg-gradient-to-bl from-emerald-100 to-surface p-5 text-right shadow-sm focus-visible:ring-2 focus-visible:ring-ring dark:from-emerald-950"
        disabled={query.isPending}
        onClick={() => {
          if (query.isError) {
            void query.refetch();
            return;
          }
          setDraft(query.data ?? empty);
          setError('');
          setOpen(true);
        }}
      >
        <span className="flex items-center gap-3 font-bold">
          <Wallet aria-hidden="true" className="size-6" />
          تنخواه
        </span>
        <span className="mt-5 block text-xl font-bold">
          {query.isPending
            ? 'در حال دریافت…'
            : query.isError
              ? 'دریافت موجودی ناموفق بود'
              : query.data
                ? `${pettyBalanceLabel(query.data.balance)} ${query.data.currencyCode}`
                : 'ثبت موجودی'}
        </span>
      </button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogTitle>موجودی و حساب تنخواه</DialogTitle>
          <DialogDescription>دفتر مستقل تنخواه</DialogDescription>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy || !editable) return;
              setBusy(true);
              setError('');
              void procurementRequest<Fund>('/petty-fund', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...draft, branchId }),
              })
                .then((saved) => {
                  setDraft(saved);
                  client.setQueryData(
                    ['procurement', 'petty-fund', branchId],
                    saved,
                  );
                  setOpen(false);
                })
                .catch((caught: unknown) =>
                  setError(
                    caught instanceof Error
                      ? caught.message
                      : 'ذخیره انجام نشد.',
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            <fieldset disabled={busy || !editable} className="contents">
              <FormField id="petty-branch" label="شعبه">
                <ProcurementSelect
                  id="petty-branch"
                  value={branchId}
                  onChange={(event) => {
                    setOpen(false);
                    setBranch(event.target.value);
                    setDraft(empty);
                  }}
                >
                  {bootstrap.branches.map((b) => (
                    <option value={b.id} key={b.id}>
                      {b.label}
                    </option>
                  ))}
                </ProcurementSelect>
              </FormField>
              <FormField id="petty-balance" label="موجودی" required>
                <MoneyInput
                  id="petty-balance"
                  value={draft.balance}
                  onValueChange={(balance) => setDraft({ ...draft, balance })}
                />
              </FormField>
              <FormField id="petty-currency" label="ارز" required>
                <Input
                  id="petty-currency"
                  maxLength={3}
                  disabled={Boolean(query.data)}
                  value={draft.currencyCode}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      currencyCode: e.target.value.toUpperCase(),
                    })
                  }
                />
              </FormField>
              {(
                [
                  ['bankName', 'نام بانک'],
                  ['accountNumber', 'شماره حساب'],
                  ['iban', 'شبا'],
                  ['cardNumber', 'شماره کارت'],
                ] as const
              ).map(([key, label]) => (
                <FormField id={`petty-${key}`} key={key} label={label}>
                  <Input
                    id={`petty-${key}`}
                    value={draft[key]}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: e.target.value })
                    }
                  />
                </FormField>
              ))}
            </fieldset>
            {query.isError && (
              <Alert tone="error" title="دریافت تنخواه ناموفق بود" />
            )}
            {error && (
              <Alert tone="error" title="ذخیره انجام نشد" description={error} />
            )}
            <Button
              type="submit"
              loading={busy}
              disabled={!editable || query.isPending || query.isError}
            >
              ذخیره
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
