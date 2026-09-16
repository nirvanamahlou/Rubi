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
            className="text-destructive hover:text-destructive"
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
