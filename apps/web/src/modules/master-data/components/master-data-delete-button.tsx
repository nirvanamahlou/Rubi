'use client';

import type { MasterDataRecord } from '@nora/contracts';
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
import { MasterDataApiError, masterDataApi } from '../api/client';

interface MasterDataDeleteButtonProps {
  record: Pick<MasterDataRecord, 'id' | 'resource' | 'name' | 'version'>;
  onDeleted: () => void | Promise<void>;
  onChanged?: () => void | Promise<void>;
}

export function MasterDataDeleteButton({
  record,
  onDeleted,
  onChanged,
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
    let deactivated = false;
    try {
      await masterDataApi.remove(target.resource, target.id, target.version);
    } catch (cause) {
      const linkedTemplate =
        target.resource === 'manifest-templates' &&
        cause instanceof MasterDataApiError &&
        cause.status === 409 &&
        /استفاده|MASTER_DATA_IN_USE/.test(cause.message) &&
        Boolean(onChanged);
      if (linkedTemplate) {
        try {
          await masterDataApi.setStatus(
            target.resource,
            target.id,
            'inactive',
            target.version,
          );
          deactivated = true;
        } catch (statusError) {
          if (mounted.current)
            setError(
              statusError instanceof Error
                ? statusError.message
                : 'غیرفعال‌سازی قالب انجام نشد.',
            );
          return;
        }
      } else {
        if (mounted.current)
          setError(
            cause instanceof Error ? cause.message : 'حذف رکورد ناموفق بود.',
          );
        return;
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    }
    if (mounted.current) {
      setOpen(false);
      if (deactivated) await onChanged?.();
      else await onDeleted();
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
        {target.resource === 'manifest-templates' ? (
          <DialogTitle>حذف یا غیرفعال‌سازی قالب</DialogTitle>
        ) : (
          <DialogTitle>حذف دائمی رکورد</DialogTitle>
        )}
        <DialogDescription>
          {target.resource === 'manifest-templates'
            ? 'آیا از حذف «' +
              target.name +
              '» مطمئن هستید؟ قالب بدون استفاده حذف می‌شود؛ قالب متصل به بلیط برای حفظ خروجی‌های قبلی غیرفعال می‌شود.'
            : 'آیا از حذف «' +
              target.name +
              '» مطمئن هستید؟ این کار قابل بازگشت نیست. فقط رکورد بدون استفاده حذف می‌شود و سابقه عملیات باقی می‌ماند.'}
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
            {target.resource === 'manifest-templates'
              ? 'حذف یا غیرفعال‌سازی'
              : 'حذف دائمی'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
