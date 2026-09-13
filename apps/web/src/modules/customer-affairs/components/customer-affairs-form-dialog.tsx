'use client';

import { useRef, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';

/** Mounted by the owning form so drafts survive errors, but reset after cancel. */
export function CustomerAffairsFormDialog({
  title,
  description,
  busy = false,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        dir="rtl"
        className="max-h-[calc(100dvh-2rem)] max-w-3xl overflow-y-auto p-4 sm:p-6"
        aria-busy={busy}
        onOpenAutoFocus={() => {
          returnFocus.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus.current?.focus();
        }}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogTitle className="pe-12">{title}</DialogTitle>
        <DialogDescription>
          {description ||
            'اطلاعات را تکمیل کنید و برای ذخیره، دکمهٔ ثبت را بزنید.'}
        </DialogDescription>
        <fieldset disabled={busy} className="min-w-0 border-0 p-0">
          {children}
        </fieldset>
      </DialogContent>
    </Dialog>
  );
}
