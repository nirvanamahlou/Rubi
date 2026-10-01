'use client';
import { travelRequest } from './travel-workflow-form';
import type { ReservationTicketDocumentV1 } from '@nora/contracts';
import { readTicketAirlineMarks } from '@/modules/ticket-catalog/public/airline-marks';
import type { TicketLayoutAirline } from '@/components/travel/flight-ticket-layout';

import {
  readTicketDocumentFacts,
  type TicketDocumentFacts,
} from '@/modules/ticket-catalog/public/document-details';
import { useEffect, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useTravelLogo } from './travel-document';
import type { ReservationIntakeV1, TravelBrandingV1 } from '@nora/contracts';
import { salesContractFlights } from '@nora/contracts';
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
import {
  passengerFilesRequest,
  type PassengersResponse,
} from '../passenger-files/client';

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
  const [documents, setDocuments] = useState<
    readonly ReservationTicketDocumentV1[]
  >(request.ticketDocuments ?? []);
  const [numberChoices, setNumberChoices] = useState<
    Array<{
      customerId: string;
      automatic: boolean;
      document: ReservationTicketDocumentV1 | null;
    }>
  >([]);
  const [manualNumbers, setManualNumbers] = useState<Record<string, string>>(
    {},
  );
  const [issuing, setIssuing] = useState(false);
  useEffect(() => {
    let active = true;
    void travelRequest<{ data: typeof numberChoices }>(
      `reservations/requests/${request.id}/ticket-documents`,
    )
      .then(({ data }) => {
        if (active && Array.isArray(data)) {
          setNumberChoices(data);
          setDocuments(
            data.flatMap((row) => (row.document ? [row.document] : [])),
          );
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [request.id]);
  const [passengerNames, setPassengerNames] = useState<Record<string, string>>(
    {},
  );
  const [airlineMarks, setAirlineMarks] = useState<
    Record<string, TicketLayoutAirline>
  >({});
  const [passengerGender, setPassengerGender] = useState<
    Record<string, 'M' | 'F' | null>
  >({});
  const [ticketFacts, setTicketFacts] = useState<
    Record<string, TicketDocumentFacts>
  >({});
  const [factsReady, setFactsReady] = useState<ReservationIntakeV1 | null>(
    null,
  );
  const [passengersReady, setPassengersReady] = useState('');
  const tickets = reservationTickets(request.snapshot, passengerNames).map(
    (ticket) => ({
      ...ticket,
      ...(documents.find((doc) => doc.customerId === ticket.passengerId)
        ? {
            eTicketNumber: documents.find(
              (doc) => doc.customerId === ticket.passengerId,
            )!.number,
            issuedAt: documents.find(
              (doc) => doc.customerId === ticket.passengerId,
            )!.issuedAt,
          }
        : {}),
      gender: passengerGender[ticket.passengerId] ?? null,
      airlines: airlineMarks,
      offers: ticket.offers.map((offer) => ({
        ...offer,
        ...(offer.offerId ? ticketFacts[offer.offerId] : {}),
      })),
    }),
  );
  useEffect(() => {
    let active = true;
    const base = getPublicApiBaseUrl();
    if (!base) {
      void Promise.resolve().then(() => {
        if (active) setFactsReady(request);
      });
      return;
    }
    void readTicketAirlineMarks(
      reservationTickets(request.snapshot).flatMap((ticket) =>
        ticket.offers.map((offer) => offer.carrierName),
      ),
      (path) =>
        fetch(base + path, { credentials: 'include', cache: 'no-store' }),
    ).then((marks) => {
      if (active) setAirlineMarks(marks);
    });
    void readTicketDocumentFacts(
      reservationTickets(request.snapshot).flatMap((ticket) => ticket.offers),
      (path) =>
        fetch(base + path, { credentials: 'include', cache: 'no-store' }),
    ).then((facts) => {
      if (active) {
        setTicketFacts(facts);
        void Promise.resolve().then(() => {
          if (active) setFactsReady(request);
        });
      }
    });
    return () => {
      active = false;
    };
  }, [request]);
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
  useEffect(() => {
    let active = true;
    void passengerFilesRequest<PassengersResponse>(request.id, 'passengers')
      .then(({ data }) => {
        if (!active) return;
        setPassengerGender(
          Object.fromEntries(
            data.map((passenger) => [passenger.id, passenger.gender]),
          ),
        );
        setPassengerNames(
          Object.fromEntries(
            data.map((passenger) => [
              passenger.id,
              [
                passenger.passportFirstName?.trim(),
                passenger.passportLastName?.trim(),
              ]
                .filter(Boolean)
                .join(' ') || passenger.displayName,
            ]),
          ),
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setPassengersReady(request.id);
      });
    return () => {
      active = false;
    };
  }, [request.id]);
  async function ensureNumbers(all: boolean) {
    const targets = all ? tickets : ticket ? [ticket] : [];
    const saved = [...documents];
    for (const target of targets) {
      if (saved.some((doc) => doc.customerId === target.passengerId)) continue;
      const choice = numberChoices.find(
        (row) => row.customerId === target.passengerId,
      );
      if (!choice)
        throw new Error('اطلاعات شماره‌گذاری آماده نیست؛ دوباره تلاش کنید.');
      if (
        !choice.automatic &&
        !/^[0-9]{6}$/.test(manualNumbers[target.passengerId] ?? '')
      )
        throw new Error(
          `شماره شش‌رقمی بلیط ${target.passengerName} را وارد کنید.`,
        );
      const { data } = await travelRequest<{
        data: ReservationTicketDocumentV1;
      }>(`reservations/requests/${request.id}/ticket-documents`, {
        customerId: target.passengerId,
        ...(!choice.automatic
          ? { number: manualNumbers[target.passengerId] }
          : {}),
      });
      saved.push(data);
      flushSync(() => setDocuments([...saved]));
    }
  }
  async function registerNumber() {
    setIssuing(true);
    setWarning('');
    try {
      await ensureNumbers(false);
    } catch (error) {
      setWarning(
        error instanceof Error ? error.message : 'ثبت شماره انجام نشد.',
      );
    } finally {
      setIssuing(false);
    }
  }
  async function print(all: boolean) {
    try {
      await ensureNumbers(all);
    } catch (error) {
      setWarning(
        error instanceof Error ? error.message : 'ثبت شماره انجام نشد.',
      );
      return;
    }
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
      await ensureNumbers(all);
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
              {ticket && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                  <span className="text-sm">E-Ticket No</span>
                  {documents.find(
                    (doc) => doc.customerId === ticket.passengerId,
                  ) ? (
                    <strong dir="ltr">
                      {
                        documents.find(
                          (doc) => doc.customerId === ticket.passengerId,
                        )!.number
                      }
                    </strong>
                  ) : (
                    <>
                      {numberChoices.find(
                        (row) => row.customerId === ticket.passengerId,
                      )?.automatic ? (
                        <span className="text-sm text-muted-foreground">
                          شماره ظرفیت شرکت به‌صورت خودکار صادر می‌شود.
                        </span>
                      ) : (
                        <input
                          aria-label="شماره شش‌رقمی بلیط شناور"
                          dir="ltr"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="000000"
                          className="rounded-lg border border-border bg-surface px-3 py-2"
                          value={manualNumbers[ticket.passengerId] ?? ''}
                          onChange={(event) =>
                            setManualNumbers({
                              ...manualNumbers,
                              [ticket.passengerId]: event.target.value.replace(
                                /[^0-9]/g,
                                '',
                              ),
                            })
                          }
                        />
                      )}
                      <Button
                        disabled={issuing || !numberChoices.length}
                        onClick={() => void registerNumber()}
                      >
                        {issuing ? 'در حال ثبت…' : 'ثبت شماره و تاریخ صدور'}
                      </Button>
                    </>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={
                    !ready ||
                    factsReady !== request ||
                    passengersReady !== request.id ||
                    downloading ||
                    !ticket
                  }
                  onClick={() => void download(false)}
                >
                  {downloading ? 'در حال ساخت PDF…' : 'دانلود PDF این مسافر'}
                </Button>
                <Button
                  disabled={
                    !ready ||
                    factsReady !== request ||
                    passengersReady !== request.id ||
                    downloading
                  }
                  onClick={() => void download(true)}
                >
                  دانلود PDF همهٔ مسافران
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    !ready ||
                    factsReady !== request ||
                    passengersReady !== request.id ||
                    printing ||
                    !ticket
                  }
                  onClick={() => void print(false)}
                >
                  چاپ این مسافر
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    !ready ||
                    factsReady !== request ||
                    passengersReady !== request.id ||
                    printing
                  }
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
                      gender: passengerGender[ticket.passengerId] ?? null,
                      airlines: airlineMarks,
                      ...(branding
                        ? {
                            branding: {
                              name: branding.name,
                              logo,
                              companyCode: branding.companyCode ?? '',
                            },
                          }
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
                    ? {
                        branding: {
                          name: branding.name,
                          logo,
                          companyCode: branding.companyCode ?? '',
                        },
                      }
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
