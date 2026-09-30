'use client';

import type { ReactNode } from 'react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { useMasterDataDialogFocusRestore } from './use-master-data-dialog-focus-restore';

interface MasterDataProfileDialogProps {
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}

export function MasterDataProfileDialog({
  children,
  onOpenChange,
  open,
  title,
}: MasterDataProfileDialogProps) {
  const focusRestore = useMasterDataDialogFocusRestore();
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        {...focusRestore}
        aria-describedby={undefined}
        className="start-auto left-1/2 max-h-[calc(100dvh-1rem)] max-w-6xl overflow-y-auto border-sky-100 bg-background p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-6 dark:border-sky-950"
        dir="rtl"
      >
        <div className="rounded-xl bg-gradient-to-l from-sky-50 to-indigo-50/60 px-4 py-3 pe-10 dark:from-sky-950/40 dark:to-indigo-950/20">
          <DialogTitle className="text-lg font-black">{title}</DialogTitle>
        </div>
        <div className="mt-4 sm:mt-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
