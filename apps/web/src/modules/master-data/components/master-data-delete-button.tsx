'use client';

import type { MasterDataRecord } from '@rubi/contracts';
import { Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/overlays';
import { masterDataApi } from '../api/client';

interface MasterDataDeleteButtonProps {
  record: Pick<MasterDataRecord, 'id' | 'resource' | 'name' | 'version'>;
  onDeleted: () => void | Promise<void>;
}

export function MasterDataDeleteButton({
  record,
  onDeleted,
}: MasterDataDeleteButtonProps) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(record);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const cancelButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function confirmDelete() {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await masterDataApi.remove(target.resource, target.id, target.version);
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error ? cause.message : 'حذف رکورد ناموفق بود.',
        );
      return;
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    }
    if (mounted.current) {
      setOpen(false);
      await onDeleted();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (inFlight.current) return;
        if (next) {
          setTarget({ ...record });
          setError(null);
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button
          aria-label={`حذف ${record.name}`}
          className="text-destructive hover:text-destructive"
          size="sm"
          variant="outline"
        >
          <Trash2 aria-hidden="true" className="size-4" /> حذف
        </Button>
      </DialogTrigger>
      <DialogContent
        aria-busy={pending}
        className="start-auto left-1/2"
        dir="rtl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelButton.current?.focus();
        }}
      >
        <DialogTitle>حذف دائمی رکورد</DialogTitle>
        <DialogDescription>
          آیا از حذف «{target.name}» مطمئن هستید؟ این کار قابل بازگشت نیست. فقط
          رکورد بدون استفاده حذف می‌شود و سابقه عملیات باقی می‌ماند.
        </DialogDescription>
        {error ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            ref={cancelButton}
            disabled={pending}
            onClick={() => setOpen(false)}
            variant="outline"
          >
            انصراف
          </Button>
          <Button
            disabled={pending}
            loading={pending}
            onClick={() => void confirmDelete()}
            variant="destructive"
          >
            حذف دائمی
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
