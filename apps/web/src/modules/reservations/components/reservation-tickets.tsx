'use client';
import { useEffect, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useTravelLogo } from './travel-document';
import type { ReservationIntakeV1, TravelBrandingV1 } from '@rubi/contracts';
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
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';

export function ReservationTickets({
  request,
  branding = null,
  salesContractId,
  onClose,
}: {
  request: ReservationIntakeV1;
  branding?: TravelBrandingV1 | null;
  salesContractId?: string;
  onClose: () => void;
}) {
  const { logo, error: logoError } = useTravelLogo(branding);
  const tickets = reservationTickets(request.snapshot);
  const [selected, setSelected] = useState(tickets[0]?.passengerId ?? '');
  const [names, setNames] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [warning, setWarning] = useState('');
  const [printAll, setPrintAll] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);
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
    if (branding && (!logo || logoError)) {
      setWarning(logoError || 'در حال دریافت لوگو');
      return;
    }
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
  async function download(all: boolean) {
    const passengerId = all ? '' : ticket?.passengerId;
    if (downloading || (!all && !passengerId)) return;
    setDownloading(true);
    setWarning('');
    try {
      const parameters = new URLSearchParams();
      if (passengerId) parameters.set('passengerId', passengerId);
      if (salesContractId) parameters.set('salesContractId', salesContractId);
      const path = `/reservations/requests/${encodeURIComponent(request.id)}/tickets/pdf${parameters.size ? `?${parameters}` : ''}`;
      const send = () =>
        fetch(path, { credentials: 'include', cache: 'no-store' });
      let response = await send();
      const base = getPublicApiBaseUrl();
      if (
        response.status === 401 &&
        base &&
        (await refreshAuthenticatedSession(base))
      )
        response = await send();
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.message || 'دریافت PDF بلیط انجام نشد.');
      }
      if (!response.headers.get('content-type')?.includes('application/pdf'))
        throw new Error('پاسخ سرور فایل PDF نیست؛ دوباره وارد حساب شوید.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `tickets-${request.snapshot.contractNumber.replace(/[^A-Za-z0-9_-]/g, '_')}-${all ? 'all' : 'passenger'}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      setWarning(
        error instanceof Error ? error.message : 'دریافت PDF بلیط انجام نشد.',
      );
    } finally {
      setDownloading(false);
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
            بلیط صادرشدهٔ قرارداد {request.snapshot.contractNumber}
          </DialogTitle>
          <DialogDescription>
            مسافر را انتخاب و فایل PDF را دریافت کنید.
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
                  disabled={!ready || downloading || !ticket}
                  onClick={() => void download(false)}
                >
                  {downloading ? 'در حال ساخت PDF…' : 'دانلود PDF این مسافر'}
                </Button>
                <Button
                  disabled={!ready || downloading}
                  onClick={() => void download(true)}
                >
                  دانلود PDF همهٔ مسافران
                </Button>
                <Button
                  variant="outline"
                  disabled={!ready || printing || !ticket}
                  onClick={() => void print(false)}
                >
                  چاپ این مسافر
                </Button>
                <Button
                  variant="outline"
                  disabled={!ready || printing}
                  onClick={() => void print(true)}
                >
                  چاپ همهٔ مسافران
                </Button>
              </div>
              {warning ? (
                <p role="status" className="text-sm text-amber-700">
                  {warning}
                </p>
              ) : null}
              <div className="min-h-0 overflow-auto rounded-xl bg-slate-100 p-3">
                {ticket ? (
                  <FlightTicketSheet
                    data={{
                      ...ticket,
                      ...(branding
                        ? { branding: { name: branding.name, logo } }
                        : {}),
                    }}
                    cityName={name}
                  />
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
              <FlightTicketSheet
                data={{
                  ...item,
                  ...(branding
                    ? { branding: { name: branding.name, logo } }
                    : {}),
                }}
                cityName={name}
              />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
