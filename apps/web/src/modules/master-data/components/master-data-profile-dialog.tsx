'use client';

import type { ReactNode } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';

interface MasterDataProfileDialogProps {
  children: ReactNode;
  description: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}

export function MasterDataProfileDialog({
  children,
  description,
  onOpenChange,
  open,
  title,
}: MasterDataProfileDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="start-auto left-1/2 max-h-[calc(100dvh-2rem)] max-w-6xl overflow-y-auto p-5 sm:p-6"
        dir="rtl"
      >
        <div className="border-b border-border pb-4 pe-10">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </div>
        <div className="mt-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
