'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';

export function DossierFormDialog({
  title,
  description,
  children,
  onSave,
  onClose,
  destructive = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onSave: () => Promise<void>;
  onClose: () => void;
  destructive?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const submitting = useRef(false);
  const close = () => {
    if (!submitting.current) onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="b2b-design b2b-modal agreement-modal"
        dir="rtl"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (submitting.current || uncertain) return;
            submitting.current = true;
            setBusy(true);
            setError('');
            try {
              await onSave();
              submitting.current = false;
              onClose();
            } catch (caught) {
              const status =
                caught && typeof caught === 'object' && 'status' in caught
                  ? Number(caught.status)
                  : 0;
              setUncertain(!status || status >= 500);
              setError(
                caught instanceof Error
                  ? caught.message
                  : 'ثبت اطلاعات تأیید نشد.',
              );
            } finally {
              submitting.current = false;
              setBusy(false);
            }
          }}
        >
          <fieldset
            disabled={busy || uncertain}
            className="grid gap-4 sm:grid-cols-2"
          >
            {children}
          </fieldset>
          {error ? (
            <p role="alert" className="form-error mt-4">
              {error}
              {uncertain
                ? ' نتیجه درخواست مشخص نیست؛ پیش از ثبت دوباره، پنجره را ببندید و فهرست تازه‌شده را بررسی کنید.'
                : ''}
            </p>
          ) : null}
          <div className="wizard-actions mt-5">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={close}
            >
              {uncertain ? 'بستن و تازه‌سازی' : 'انصراف'}
            </Button>
            <Button
              type="submit"
              variant={destructive ? 'destructive' : 'primary'}
              loading={busy}
              disabled={uncertain}
            >
              {destructive ? 'تأیید حذف دائمی' : 'ذخیره اطلاعات'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
