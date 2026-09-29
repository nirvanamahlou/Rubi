'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { toursApi } from '../api/tours';
export function ManifestTemplatePicker({
  value,
  name,
  readOnly = false,
  onChange,
}: {
  value: string | null;
  name?: string | undefined;
  readOnly?: boolean;
  onChange: (id: string | null, name: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(''),
    [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([search, attempt]);
  const [result, setResult] = useState<{
    key: string;
    data: { id: string; name: string }[];
    error?: string;
  }>();
  useEffect(() => {
    if (!open || readOnly) return;
    let active = true;
    const timer = setTimeout(() => {
      void toursApi
        .manifestTemplates(search, 1)
        .then((data) => {
          if (active) setResult({ key, data: data.data });
        })
        .catch((error: unknown) => {
          if (active)
            setResult({
              key,
              data: [],
              error:
                error instanceof Error
                  ? error.message
                  : 'دریافت قالب‌ها ناموفق بود.',
            });
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, readOnly, search, key]);
  const current = result?.key === key ? result : undefined;
  return (
    <div className="grid gap-2">
      <label htmlFor="ticket-manifest-template" className="text-sm font-medium">
        انتخاب قالب منیفست
      </label>
      <SearchCombobox
        id="ticket-manifest-template"
        label="قالب‌های منیفست"
        value={value ?? ''}
        selectedLabel={value ? name || 'قالب انتخاب‌شده' : 'پیش‌فرض'}
        disabled={readOnly}
        remote
        loading={!current}
        error={current?.error}
        onSearchChange={setSearch}
        onOpenChange={setOpen}
        options={[
          { value: '', label: 'پیش‌فرض' },
          ...(current?.data ?? []).map((row) => ({
            value: row.id,
            label: row.name,
          })),
        ]}
        onValueChange={(id) =>
          onChange(
            id || null,
            current?.data.find((row) => row.id === id)?.name ?? 'پیش‌فرض',
          )
        }
        footer={
          current?.error ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAttempt((n) => n + 1)}
            >
              تلاش دوباره
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
