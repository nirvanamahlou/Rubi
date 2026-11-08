'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { Button } from '@/components/ui/button';
import { legalEntitiesApi, type ArchivedContracts } from '../api/client';
import { useLegalEntityContext } from './legal-entity-context';

export function ContractArchive() {
  const { context } = useLegalEntityContext();
  const permissions = useAccessPermissions();
  const canRestore = permissions?.includes('system.settings.manage') === true;
  const generation = useRef(0);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ArchivedContracts | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setBusy(true);
    setMessage('');
    setSelected([]);
    setResult(null);
    try {
      const data = await legalEntitiesApi.archivedContracts(search, page);
      if (request === generation.current) setResult(data);
    } catch (e) {
      if (request === generation.current)
        setMessage(
          e instanceof Error ? e.message : 'دریافت اطلاعات ناموفق بود.',
        );
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }, [search, page]);
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void load(), 250);
    return () => {
      clearTimeout(timer);
      invalidate();
    };
  }, [open, load, context?.version, invalidate]);
  async function restore() {
    setBusy(true);
    setMessage('');
    try {
      const response = await legalEntitiesApi.restoreContracts(selected);
      await load();
      setMessage(
        `${response.restored} قرارداد به فروش، رزرواسیون و مالی بازگردانده شد.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'بازگردانی ناموفق بود.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="my-5 rounded-2xl border bg-white p-5 dark:bg-slate-950">
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        قراردادهای پنهان‌شده و بازگردانی
      </Button>
      {open && (
        <div className="mt-4 grid gap-4">
          <p className="text-sm">
            قراردادهای با شروع سفر قبل از ۱ آبان ۱۴۰۵؛ مربوط به شرکت انتخاب‌شده.
            بازگردانی در هر سه بخش اعمال می‌شود.
          </p>
          <input
            aria-label="جست‌وجوی قرارداد پنهان‌شده"
            placeholder="شماره قرارداد یا نام مشتری"
            className="rounded-lg border p-2"
            value={search}
            disabled={busy}
            onChange={(e) => {
              setSelected([]);
              setResult(null);
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {message && <p role="status">{message}</p>}
          {busy && <p role="status">در حال دریافت اطلاعات…</p>}
          {result && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>انتخاب</th>
                    <th>قرارداد</th>
                    <th>مشتری</th>
                    <th>شروع سفر</th>
                    <th>شرکت</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          disabled={busy || !canRestore}
                          aria-label={`انتخاب قرارداد ${row.contractNumber}`}
                          checked={selected.includes(row.id)}
                          onChange={(e) =>
                            setSelected((ids) =>
                              e.target.checked
                                ? [...ids, row.id]
                                : ids.filter((id) => id !== row.id),
                            )
                          }
                        />
                      </td>
                      <td>{row.contractNumber}</td>
                      <td>{row.customerNameSnapshot}</td>
                      <td dir="ltr">{row.departureDate.slice(0, 10)}</td>
                      <td>{row.legalEntity?.persianName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!result.total && <p>قرارداد پنهان‌شده‌ای یافت نشد.</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={busy || !selected.length || !canRestore}
              onClick={() => void restore()}
            >
              بازگردانی قراردادهای انتخاب‌شده
            </Button>
            <Button
              variant="outline"
              disabled={busy || page <= 1}
              onClick={() => setPage(page - 1)}
            >
              قبلی
            </Button>
            <span>{page}</span>
            <Button
              variant="outline"
              disabled={busy || !result || page * 50 >= result.total}
              onClick={() => setPage(page + 1)}
            >
              بعدی
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
