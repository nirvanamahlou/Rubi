'use client';
import { useState } from 'react';
import { Input, Textarea } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { AccountingButton as Button } from './accounting-operations';
import type { SetupNote } from './accounting-setup-notes';

/** Scoped notes editor: tax attachment targets are not registered yet. */
export function AccountingTaxNotes({
  notes,
  onChange,
}: {
  notes: SetupNote[];
  onChange: (notes: SetupNote[]) => void;
}) {
  const [draft, setDraft] = useState<SetupNote | null>(null);
  return (
    <div className="space-y-4">
      <fieldset className="rounded border p-3">
        <legend>یادداشت ها</legend>
        <Button
          type="button"
          variant="outline"
          disabled={notes.length >= 10}
          onClick={() =>
            setDraft({ id: crypto.randomUUID(), title: '', date: '', text: '' })
          }
        >
          جدید
        </Button>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                {[
                  'عنوان',
                  'تاریخ یادداشت',
                  'کاربر ایجاد کننده',
                  'تاریخ ایجاد',
                  'آخرین تغییردهنده',
                  'تاریخ آخرین تغییر',
                  '',
                ].map((label, index) => (
                  <th key={index} className="p-2">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.id}>
                  <td>
                    <button
                      type="button"
                      className="underline"
                      onClick={() => setDraft({ ...note })}
                    >
                      {note.title}
                    </button>
                  </td>
                  <td>{note.date}</td>
                  <td>{note.createdBy}</td>
                  <td>{note.createdAt}</td>
                  <td>{note.updatedBy}</td>
                  <td>{note.updatedAt}</td>
                  <td>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        onChange(notes.filter((item) => item.id !== note.id))
                      }
                    >
                      حذف
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>
      <fieldset className="rounded border p-3">
        <legend>پیوست ها</legend>
        <table className="w-full text-xs">
          <thead>
            <tr>
              {['عنوان', 'فایل', 'پیوست کننده', 'تاریخ پیوست'].map((label) => (
                <th key={label} className="p-2">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
        </table>
        <p className="p-2 text-sm text-muted-foreground">
          پیوست‌های این بخش هنوز به سرویس اسناد متصل نشده‌اند.
        </p>
      </fieldset>
      <Dialog
        open={Boolean(draft)}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
      >
        <DialogContent>
          <DialogTitle>یادداشت</DialogTitle>
          {draft && (
            <div className="space-y-3">
              <label className="block space-y-1">
                عنوان
                <Input
                  aria-label="عنوان"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                />
              </label>
              <label className="block space-y-1">
                تاریخ
                <DatePicker
                  aria-label="تاریخ"
                  withinDialog
                  value={draft.date}
                  onChange={(date) => setDraft({ ...draft, date })}
                />
              </label>
              <label className="block space-y-1">
                یادداشت
                <Textarea
                  aria-label="یادداشت"
                  value={draft.text}
                  onChange={(event) =>
                    setDraft({ ...draft, text: event.target.value })
                  }
                />
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={!draft.title.trim() || !draft.text.trim()}
                  onClick={() => {
                    onChange(
                      notes.some((item) => item.id === draft.id)
                        ? notes.map((item) =>
                            item.id === draft.id ? draft : item,
                          )
                        : [...notes, draft],
                    );
                    setDraft(null);
                  }}
                >
                  تایید
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDraft(null)}
                >
                  انصراف
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
