'use client';
import { useEffect, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import type { ReservationIntakeV1 } from '@rubi/contracts';
import { salesContractFlights } from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { masterDataApi } from '@/modules/master-data/api/client';
import { FlightTicketSheet } from '@/modules/sales/public/tickets';
import { reservationTickets } from '../model/reservation-tickets';

export function ReservationTickets({
  request,
  onClose,
}: {
  request: ReservationIntakeV1;
  onClose: () => void;
}) {
  const tickets = reservationTickets(request.snapshot);
  const [selected, setSelected] = useState(tickets[0]?.passengerId ?? '');
  const [names, setNames] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState('');
  const [printAll, setPrintAll] = useState(false);
  const [printing, setPrinting] = useState(false);
  const ticket = tickets.find((item) => item.passengerId === selected);
  useEffect(() => {
    let active = true;
    const ids = [
      ...new Set(
        salesContractFlights(
          request.snapshot.serviceSelections,
          request.snapshot.ticketSelections ?? [],
        ).flatMap((item) => [item.originId, item.destinationId]),
      ),
    ];
    void Promise.all(
      ids.map(async (id) => {
        try {
          const { data } = await masterDataApi.detail('cities', id);
          return [
            id,
            String(data.attributes.englishName || data.name),
          ] as const;
        } catch {
          return [id, '—'] as const;
        }
      }),
    ).then((entries) => {
      if (!active) return;
      setNames(Object.fromEntries(entries));
      if (entries.some(([, name]) => name === '—'))
        setWarning(
          'نام بعضی شهرها در دسترس نیست؛ پیش از ارسال خروجی بررسی کنید.',
        );
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [request]);
  async function print(all: boolean) {
    flushSync(() => {
      setPrintAll(all);
      setPrinting(true);
    });
    try {
      await Promise.all(
        Array.from(
          document.querySelectorAll<HTMLImageElement>(
            '[data-reservation-ticket-print] img',
          ),
        ).map((img) => img.decode()),
      );
      window.print();
    } catch {
      setWarning('لوگو بارگذاری نشد؛ دوباره چاپ را بزنید.');
    } finally {
      setPrinting(false);
    }
  }
  const name = (id: string) => names[id] || '—';
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent
          className="flex max-h-[90vh] max-w-5xl flex-col gap-3 overflow-hidden"
          dir="rtl"
        >
          <DialogTitle>
            بلیط‌های قرارداد {request.snapshot.contractNumber}
          </DialogTitle>
          <DialogDescription>
            نسخهٔ ذخیره‌شدهٔ {request.contractVersion}؛ از همین قرارداد
            می‌توانید دوباره دریافت کنید. این خروجی هنوز بلیط صادرشدهٔ ایرلاین
            نیست.
          </DialogDescription>
          {tickets.length ? (
            <>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="انتخاب مسافر بلیط"
              >
                {tickets.map((item) => (
                  <Button
                    key={item.passengerId}
                    type="button"
                    variant={
                      selected === item.passengerId ? 'primary' : 'outline'
                    }
                    aria-pressed={selected === item.passengerId}
                    onClick={() => setSelected(item.passengerId)}
                  >
                    {item.passengerName}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!ready || printing || !ticket}
                  onClick={() => void print(false)}
                >
                  چاپ / ذخیره PDF این مسافر
                </Button>
                <Button
                  variant="outline"
                  disabled={!ready || printing}
                  onClick={() => void print(true)}
                >
                  چاپ / ذخیره PDF همهٔ مسافران
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                برای فایل PDF، در پنجرهٔ چاپ «Save as PDF» را انتخاب و سرصفحه و
                پاصفحهٔ مرورگر را خاموش کنید. هر مسافر در برگهٔ جدا چاپ می‌شود.
              </p>
              {warning ? (
                <p role="status" className="text-sm text-amber-700">
                  {warning}
                </p>
              ) : null}
              <div className="min-h-0 overflow-auto rounded-xl bg-slate-100 p-3">
                {ticket ? (
                  <FlightTicketSheet data={ticket} cityName={name} />
                ) : null}
              </div>
            </>
          ) : (
            <p className="py-6">
              اطلاعات ذخیره‌شدهٔ پرواز و تخصیص آن به مسافر برای این درخواست
              موجود نیست. بلیط ساختگی تولید نمی‌شود.
            </p>
          )}
        </DialogContent>
      </Dialog>
      {createPortal(
        <div data-reservation-ticket-print style={{ display: 'none' }}>
          <style media="print">
            {
              '@page {size: A4 portrait; margin:0} body > :not([data-reservation-ticket-print]){display:none!important} body{margin:0!important;padding:0!important;overflow:visible!important} [data-reservation-ticket-print]{display:block!important} [data-reservation-ticket-page]{break-after:page} [data-reservation-ticket-page]:last-child{break-after:auto}'
            }
          </style>
          {(printAll ? tickets : ticket ? [ticket] : []).map((item) => (
            <div key={item.passengerId} data-reservation-ticket-page>
              <FlightTicketSheet data={item} cityName={name} />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
