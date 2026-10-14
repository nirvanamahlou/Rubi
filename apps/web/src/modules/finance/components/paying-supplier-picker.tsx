'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { financeInboxApi } from '../api/finance-inbox-api';

export function PayingSupplierPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setBusy(true);
      setError('');
      void financeInboxApi
        .payingSuppliers(search, page)
        .then((result) => {
          if (active) {
            setItems(result.items);
            setMore(result.hasMore);
          }
        })
        .catch((cause: unknown) => {
          if (active) {
            setItems([]);
            setError(
              cause instanceof Error
                ? cause.message
                : 'فهرست تأمین‌کنندگان در دسترس نیست.',
            );
          }
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, page]);
  return (
    <div className="grid gap-2">
      <label>
        تأمین‌کننده پرداخت‌کننده
        <Input
          disabled={disabled}
          aria-label="جست‌وجوی تأمین‌کننده پرداخت‌کننده"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
            onChange('');
          }}
        />
        <NativeSearchSelect
          aria-label="تأمین‌کننده پرداخت‌کننده"
          value={value}
          disabled={disabled || busy}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">انتخاب تأمین‌کننده</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </NativeSearchSelect>
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy || page === 1}
          onClick={() => {
            setPage(page - 1);
            onChange('');
          }}
        >
          صفحه قبلی
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy || !more}
          onClick={() => {
            setPage(page + 1);
            onChange('');
          }}
        >
          صفحه بعدی
        </Button>
      </div>
    </div>
  );
}
