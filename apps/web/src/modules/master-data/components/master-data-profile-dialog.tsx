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
        className="start-auto left-1/2 max-h-[calc(100dvh-1rem)] max-w-6xl overflow-x-hidden overflow-y-auto border-border bg-background p-4 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-5"
        dir="rtl"
      >
        <DialogTitle className="pe-10 text-base font-bold text-foreground sm:text-lg">
          {title}
        </DialogTitle>
        <div className="mt-3 space-y-4 sm:mt-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
