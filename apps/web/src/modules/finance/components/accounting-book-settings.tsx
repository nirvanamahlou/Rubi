'use client';
import { useState } from 'react';
import type { AccountingBookV1 } from '@nora/contracts';
import { AccountingButton as Button } from './accounting-operations';
import { Input, FormField } from '@/components/ui/form-controls';
export function AccountingBookSettings({
  book,
  busy,
  run,
}: {
  book: AccountingBookV1;
  busy: boolean;
  run: <T = unknown>(
    action: string,
    payload: Record<string, unknown>,
    version?: number,
  ) => Promise<T | undefined>;
}) {
  const [title, setTitle] = useState(book.title),
    [active, setActive] = useState(book.active),
    [allowsPosting, setPosting] = useState(book.allowsPosting),
    [isMain, setMain] = useState(book.isMain);
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-bold">تنظیمات دفتر انتخاب‌شده</h3>
      <FormField label="عنوان دفتر" id="accounting-book-title">
        <Input
          id="accounting-book-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </FormField>
      <div className="flex flex-wrap gap-4">
        {[
          { label: 'دفتر فعال', value: active, set: setActive },
          { label: 'اجازه ثبت قطعی', value: allowsPosting, set: setPosting },
          { label: 'دفتر اصلی', value: isMain, set: setMain },
        ].map((f) => (
          <label key={f.label} className="flex gap-2 items-center">
            <input
              type="checkbox"
              checked={f.value}
              onChange={(e) => f.set(e.target.checked)}
            />
            {f.label}
          </label>
        ))}
      </div>
      <Button
        type="button"
        disabled={busy}
        permission="finance.account.manage"
        onClick={() =>
          void run(
            'save-book',
            { title, active, allowsPosting, isMain },
            book.version,
          )
        }
      >
        ذخیره تنظیمات دفتر
      </Button>
    </section>
  );
}
