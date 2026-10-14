'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { PassengerCorrectionHistory } from '@/modules/sales/components/passenger-correction-history';

export function ContractCorrectionHistoryButton({
  contractId,
}: {
  contractId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        سوابق اصلاح قرارداد
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          dir="rtl"
          className="max-h-[90vh] max-w-4xl overflow-y-auto"
        >
          <DialogTitle>سوابق اصلاح قرارداد</DialogTitle>
          <DialogDescription>
            اصلاح‌کننده، زمان و جزئیات تغییرات
          </DialogDescription>
          {open ? (
            <PassengerCorrectionHistory
              key={contractId}
              contractId={contractId}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
export function ContractCorrectionDeepLink() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get('correctionContract');
  const eventId = params.get('correctionEvent') || undefined;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (open) return;
        const next = new URLSearchParams(params.toString());
        next.delete('correctionContract');
        next.delete('correctionEvent');
        router.replace(
          '/reservations' + (next.size ? '?' + next.toString() : ''),
          { scroll: false },
        );
      }}
    >
      <DialogContent
        dir="rtl"
        className="max-h-[90vh] max-w-4xl overflow-y-auto"
      >
        <DialogTitle>سوابق اصلاح قرارداد</DialogTitle>
        <DialogDescription>
          اصلاح‌کننده، زمان و جزئیات تغییرات
        </DialogDescription>
        <PassengerCorrectionHistory
          key={id + ':' + eventId}
          contractId={id}
          {...(eventId ? { eventId } : {})}
        />
      </DialogContent>
    </Dialog>
  );
}
