'use client';

import type { ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/overlays';
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
        className="start-auto left-1/2 max-h-[calc(100dvh-2rem)] max-w-6xl overflow-y-auto p-5 sm:p-6"
        dir="rtl"
      >
        <div className="border-b border-border pb-4 pe-10">
          <DialogTitle>{title}</DialogTitle>
        </div>
        <div className="mt-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
