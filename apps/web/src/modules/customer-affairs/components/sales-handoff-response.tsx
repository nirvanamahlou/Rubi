'use client';
import { useEffect, useState } from 'react';
import type { SalesContractSummary } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form-controls';
import { salesApi } from '@/modules/sales/api/client';
import { customerAffairsApi } from '../api/customer-affairs-client';
import { AffairsSelect } from './affairs-select';
import { CustomerAffairsFormDialog } from './customer-affairs-form-dialog';
import { AffairsFormField as FormField } from './affairs-form-field';

export function SalesHandoffResponse({
  id,
  customerId,
  branchId,
  onReload,
}: {
  id: string;
  customerId: string | null;
  branchId: string;
  onReload: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('RETURNED');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [contracts, setContracts] = useState<readonly SalesContractSummary[]>(
    [],
  );
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open || status !== 'ACCEPTED') return;
    let current = true;
    const timer = setTimeout(() => {
      setLoading(true);
      void salesApi
        .list({ search, branchId, page, pageSize: 20 })
        .then((result) => {
          if (!current) return;
          setContracts(
            result.data.filter(
              (row) => !customerId || row.customerId === customerId,
            ),
          );
          setHasMore(page * 20 < result.meta.total);
          setError('');
        })
        .catch((cause: unknown) => {
          if (current) {
            setContracts([]);
            setHasMore(false);
            setError(
              cause instanceof Error
                ? cause.message
                : 'دریافت قراردادها ناموفق بود.',
            );
          }
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [open, status, search, page, branchId, customerId]);
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setError('');
          setOpen(true);
        }}
      >
        ثبت پاسخ فروش
      </Button>
      {open && (
        <CustomerAffairsFormDialog
          title="پاسخ فروش به درخواست"
          busy={busy}
          onClose={() => setOpen(false)}
        >
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              if (status === 'ACCEPTED' && !selected) {
                setError('قرارداد فروش را انتخاب کنید.');
                return;
              }
              setBusy(true);
              setError('');
              try {
                await customerAffairsApi.respondHandoff(id, {
                  status,
                  reason: String(data.get('reason') || ''),
                  ...(status === 'ACCEPTED'
                    ? { salesContractId: selected }
                    : {}),
                });
                await onReload();
                setOpen(false);
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : 'پاسخ ثبت نشد.',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <FormField label="نتیجه بررسی فروش">
              <AffairsSelect
                aria-label="نتیجه بررسی فروش"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="RETURNED">برگشت برای تکمیل</option>
                <option value="ACCEPTED">پذیرش با قرارداد واقعی</option>
                <option value="REJECTED">رد درخواست</option>
              </AffairsSelect>
            </FormField>
            {status === 'ACCEPTED' && (
              <>
                <Input
                  aria-label="جست‌وجوی قرارداد فروش"
                  placeholder="شماره قرارداد یا نام مشتری"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                    setSelected('');
                  }}
                />
                <AffairsSelect
                  aria-label="قرارداد فروش"
                  value={selected}
                  disabled={loading}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  <option value="">انتخاب قرارداد فروش</option>
                  {selected &&
                    !contracts.some((row) => row.id === selected) && (
                      <option value={selected}>قرارداد انتخاب‌شده</option>
                    )}
                  {contracts.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.contractNumber} · {row.customerNameSnapshot}
                    </option>
                  ))}
                </AffairsSelect>
                <p className="text-xs text-muted-foreground">
                  {loading
                    ? 'در حال دریافت قراردادها…'
                    : !contracts.length
                      ? 'در این صفحه قرارداد منطبق یافت نشد؛ جست‌وجو یا صفحه بعد را بررسی کنید.'
                      : 'پذیرش، قرارداد جدید ایجاد نمی‌کند؛ درخواست به قرارداد انتخاب‌شده متصل می‌شود.'}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={loading || page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    قبلی
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={loading || !hasMore}
                    onClick={() => setPage(page + 1)}
                  >
                    بعدی
                  </Button>
                </div>
              </>
            )}
            <FormField label="دلیل و نتیجه بررسی">
              <Textarea name="reason" required minLength={3} maxLength={500} />
            </FormField>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={busy || (status === 'ACCEPTED' && !selected)}
            >
              ثبت پاسخ
            </Button>
          </form>
        </CustomerAffairsFormDialog>
      )}
    </>
  );
}
