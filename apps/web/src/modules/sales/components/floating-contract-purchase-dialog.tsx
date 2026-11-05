'use client';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlays';
import { ReservationPurchaseDialog } from '@/modules/reservations/components/reservation-hotel-purchase';
export function FloatingContractPurchaseDialog({
  id,
  onClose,
  onSaved,
}: {
  id: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        dir="rtl"
        className="max-h-[85dvh] overflow-y-auto sm:max-w-5xl"
      >
        <DialogTitle>خرید قرارداد شناور</DialogTitle>
        <ReservationPurchaseDialog
          id={id}
          salesContractId={id}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}
