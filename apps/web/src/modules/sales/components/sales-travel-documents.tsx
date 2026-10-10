'use client';
import { useState } from 'react';
import type {
  ReservationIntakeV1,
  TravelWorkflowStateV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import { travelRequest } from '@/modules/reservations/components/travel-workflow-form';
import { TravelDocument } from '@/modules/reservations/components/travel-document';
import { ReservationTickets } from '@/modules/reservations/components/reservation-tickets';
type Intake = ReservationIntakeV1 & { workflow: TravelWorkflowStateV1 };

export function SalesContractTermsDownload() {
  return (
    <a
      href="/contracts/terms.pdf"
      download="مفاد-قرارداد.pdf"
      aria-label="دانلود PDF مفاد قرارداد"
      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-primary/25 bg-background px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      دانلود مفاد قرارداد
    </a>
  );
}

export function SalesTravelDocuments({
  contractId,
  className,
  label = 'مدارک مسافر · تأیید مالی',
}: {
  contractId: string;
  className?: string;
  label?: string;
}) {
  const [intake, setIntake] = useState<Intake>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState(false);
  const [open, setOpen] = useState(false);
  async function load(showTicket = false) {
    setBusy(true);
    setError('');
    setIntake(undefined);
    setTicket(false);
    try {
      const { data } = await travelRequest<{ data: Intake }>(
        `sales/contracts/${contractId}/travel-documents`,
      );
      setIntake(data);
      setOpen(true);
      setTicket(showTicket);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'مدارک در دسترس نیست.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={className}
        disabled={busy}
        onClick={() => void load()}
      >
        {label}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) {
            setIntake(undefined);
            setTicket(false);
          }
        }}
      >
        <DialogContent
          dir="rtl"
          className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl"
        >
          <DialogTitle>مدارک مجاز برای تحویل به مسافر</DialogTitle>
          <DialogDescription>
            دسترسی در هر بار دریافت با مجوز مالی کنترل می‌شود.
          </DialogDescription>
          {intake && (
            <>
              <section
                aria-labelledby="sales-contract-terms-title"
                className="rounded-xl border border-border bg-muted/30 p-4"
              >
                <h3
                  id="sales-contract-terms-title"
                  className="text-sm font-bold"
                >
                  مفاد قرارداد
                </h3>
                <p className="mt-1 mb-3 text-xs text-muted-foreground">
                  نسخهٔ مرجع مفاد قرارداد را می‌توانید دریافت کنید.
                </p>
                <SalesContractTermsDownload />
              </section>
              <Button
                disabled={busy || !intake.workflow.branding}
                onClick={() => void load(true)}
              >
                دریافت بلیط مسافران
              </Button>
              {!intake.workflow.branding && (
                <p>سربرگ باید در رزرواسیون ثبت شود.</p>
              )}
              {intake.workflow.voucherIssued ? (
                <TravelDocument intake={intake} voucher />
              ) : (
                <p>واچر هنوز صادر نشده است.</p>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      {ticket && intake && (
        <ReservationTickets
          request={intake}
          branding={intake.workflow.branding}
          salesContractId={contractId}
          onClose={() => setTicket(false)}
        />
      )}
    </>
  );
}
