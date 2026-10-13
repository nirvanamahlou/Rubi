'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/overlays';

export function ProcurementRecordActions({
  label,
  onEdit,
  onDelete,
  deleteDisabled = false,
}: {
  label: string;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  deleteDisabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    setPending(true);
    setError('');
    try {
      await onDelete();
      setOpen(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'حذف رکورد ناموفق بود.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="flex items-center gap-1" aria-label={`اقدامات ${label}`}>
      <Button
        aria-label={`ویرایش ${label}`}
        title="ویرایش"
        size="icon"
        variant="ghost"
        className="border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-800 focus-visible:ring-sky-500 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-900/60 dark:hover:text-sky-100"
        onClick={onEdit}
      >
        <Pencil aria-hidden="true" className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogTrigger asChild>
          <Button
            aria-label={`حذف دائمی ${label}`}
            title="حذف دائمی"
            size="icon"
            variant="ghost"
            className="border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800 focus-visible:ring-rose-500 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-900/60 dark:hover:text-rose-100"
            disabled={deleteDisabled}
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </Button>
        </DialogTrigger>
        <DialogContent dir="rtl" aria-busy={pending}>
          <DialogTitle>حذف دائمی رکورد</DialogTitle>
          <DialogDescription>
            «{label}» و سوابق خریدِ متصل به آن حذف می‌شود. این کار قابل بازگشت
            نیست.
          </DialogDescription>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              loading={pending}
              onClick={() => void remove()}
            >
              حذف دائمی
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
