'use client';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { AccountingSnapshotV1 } from '@nora/contracts';
import { Input, Textarea } from '@/components/ui/form-controls';
import { AccountingButton as Button } from './accounting-operations';
import { AccountingAttachments } from './accounting-attachments';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';

export type SetupNote = {
  id: string;
  title: string;
  date: string;
  text: string;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
};
export function parseSetupNotes(value: unknown): SetupNote[] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
export function AccountingSetupNotes({
  notes,
  onChange,
  book,
  record,
}: {
  notes: SetupNote[];
  onChange: (notes: SetupNote[]) => void;
  book: AccountingSnapshotV1;
  record?: { id: string; entityType: string; title: string } | undefined;
}) {
  const [draft, setDraft] = useState<SetupNote | null>(null);
  return (
    <div className="space-y-4">
      <fieldset className="rounded border p-3">
        <legend>یادداشت ها</legend>
        <div className="mb-2 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="افزودن یادداشت"
            title="افزودن یادداشت"
            disabled={notes.length >= 10}
            onClick={() =>
              setDraft({
                id: crypto.randomUUID(),
                title: '',
                date: '',
                text: '',
              })
            }
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[38rem] text-xs">
            <thead className="bg-muted">
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
              {notes.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-1">
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => setDraft({ ...row })}
                    >
                      {row.title}
                    </button>
                  </td>
                  <td className="p-1">{row.date}</td>
                  <td>{row.createdBy}</td>
                  <td>{row.createdAt?.slice(0, 10)}</td>
                  <td>{row.updatedBy}</td>
                  <td>{row.updatedAt?.slice(0, 10)}</td>
                  <td>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label="حذف یادداشت"
                      title="حذف یادداشت"
                      onClick={() =>
                        onChange(notes.filter((note) => note.id !== row.id))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </fieldset>
      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
      >
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>یادداشت</DialogTitle>
          {draft ? (
            <div className="mt-4 space-y-3" dir="rtl">
              <label className="block space-y-1">
                <span>عنوان</span>
                <Input
                  aria-label="عنوان یادداشت"
                  value={draft.title}
                  onChange={(e) =>
                    setDraft({ ...draft, title: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1">
                <span>تاریخ یادداشت</span>
                <Input
                  aria-label="تاریخ یادداشت"
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span>یادداشت</span>
                <Textarea
                  aria-label="یادداشت"
                  value={draft.text}
                  onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDraft(null)}
                >
                  انصراف
                </Button>
                <Button
                  type="button"
                  disabled={
                    !draft.title.trim() || !draft.date || !draft.text.trim()
                  }
                  onClick={() => {
                    onChange(
                      notes.some((row) => row.id === draft.id)
                        ? notes.map((row) =>
                            row.id === draft.id ? draft : row,
                          )
                        : [...notes, draft],
                    );
                    setDraft(null);
                  }}
                >
                  تأیید
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      {record ? (
        <AccountingAttachments book={book} record={record} />
      ) : (
        <fieldset className="rounded border p-3">
          <legend>پیوست ها</legend>
          <p className="text-sm text-muted-foreground">
            برای افزودن پیوست، ابتدا رکورد را ذخیره کنید.
          </p>
        </fieldset>
      )}
    </div>
  );
}
