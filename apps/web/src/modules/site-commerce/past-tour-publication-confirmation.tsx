'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui';

export function requiresPastTourConfirmation(
  status: number,
  body: { error?: { code?: string } } | null,
) {
  return (
    status === 409 && body?.error?.code === 'PAST_TOUR_PUBLICATION_CONFIRMATION'
  );
}

export function PastTourPublicationConfirmation({
  site,
  onCancel,
  onConfirm,
}: {
  site: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <DialogTitle>انتشار تور با تاریخ گذشته</DialogTitle>
        <DialogDescription>
          تاریخ حرکت تور گذشته است. برای انتشار در {site} مطمئن هستید؟
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>
            انصراف
          </Button>
          <Button onClick={onConfirm}>بله، منتشر شود</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
