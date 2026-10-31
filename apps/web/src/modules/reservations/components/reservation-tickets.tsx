'use client';
import { usePublicDocumentLink } from '@/modules/travel-documents/public/use-public-document-link';
import { travelRequest } from './travel-workflow-form';
import type {
  ReservationTicketDocumentV1,
  TravelWorkflowStateV1,
} from '@nora/contracts';
import { readTicketAirlineMarks } from '@/modules/ticket-catalog/public/airline-marks';
import type { TicketLayoutAirline } from '@/components/travel/flight-ticket-layout';

import {
  readTicketDocumentFacts,
  type TicketDocumentFacts,
} from '@/modules/ticket-catalog/public/document-details';
import { useEffect, useState } from 'react';
import { useAccessPermissions } from '@/modules/iam/access-context';
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
  request: suppliedRequest,
  branding = null,
  salesContractId,
  onClose,
}: {
  request: ReservationIntakeV1;
  branding?: TravelBrandingV1 | null;
  salesContractId?: string;
  onClose: () => void;
}) {
  const [currentRequest, setCurrentRequest] =
    useState<ReservationIntakeV1 | null>(null);
  const [revision, setRevision] = useState(0);
  const request =
    currentRequest?.id === suppliedRequest.id
      ? currentRequest
      : suppliedRequest;
  useEffect(() => {
    const refresh = () => setRevision((v) => v + 1);
    window.addEventListener('reservation-workflow-changed', refresh);
    return () =>
      window.removeEventListener('reservation-workflow-changed', refresh);
  }, []);
  const { logo } = useTravelLogo(branding);
  const canEdit =
    useAccessPermissions()?.includes('reservations.documents.manage') ?? false;
  const [flightNumbers, setFlightNumbers] = useState<Record<string, string>>(
    {},
  );
  const [flightNumbersReady, setFlightNumbersReady] = useState('');
  const flightContextKey = `${request.id}:${salesContractId ?? ''}`;
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
  const tickets = reservationTickets(
    request.snapshot,
    passengerNames,
    flightNumbers,
  ).map((ticket) => ({
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
  }));
  useEffect(() => {
    let active = true;
    const base = getPublicApiBaseUrl();
    if (!base) {
      void Promise.resolve().then(() => {
        if (active) setFactsReady(request);
      });
      return;
    }
    const marksReady = readTicketAirlineMarks(
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
    ).then(async (facts) => {
      await marksReady;
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
  useEffect(() => {
    let active = true;
    void travelRequest<{
      data: ReservationIntakeV1 & { workflow: TravelWorkflowStateV1 };
    }>(
      salesContractId
        ? `sales/contracts/${salesContractId}/travel-documents`
        : `reservations/requests/${request.id}/workflow`,
    )
      .then(({ data }) => {
        if (!active) return;
        if (data.snapshot) setCurrentRequest(data);
        setFlightNumbers(data.workflow.ticketFlightNumbers ?? {});
        setFlightNumbersReady(flightContextKey);
      })
      .catch((cause: unknown) => {
        if (active)
          setWarning(
            cause instanceof Error
              ? cause.message
              : 'دریافت شماره پرواز ناموفق بود.',
          );
      });
    return () => {
      active = false;
    };
  }, [
    request.id,
    salesContractId,
    flightContextKey,
    revision,
    suppliedRequest,
  ]);
  const printAll = false;
  const printDocument = '';
  const [downloading, setDownloading] = useState(false);
  const ticket = tickets.find((item) => item.passengerId === selected);
  const shared = usePublicDocumentLink(
    branding && documents.length
      ? '/reservations/requests/' +
          encodeURIComponent(request.id) +
          '/tickets/pdf?' +
          new URLSearchParams({
            ...(salesContractId ? { salesContractId } : {}),
          })
      : undefined,
    JSON.stringify([request.snapshot, documents, flightNumbers]),
  );
  const documentUrl = (passengerId: string) =>
    shared?.documents?.find((item) => item.passengerId === passengerId)?.url;
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
          const { data } = await masterDataApi.detail(
            'cities',
            id,
            'reservations',
          );
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
      const existing = saved.find(
        (doc) => doc.customerId === target.passengerId,
      );
      const manual = manualNumbers[target.passengerId];
      if (existing && (manual === undefined || manual === existing.number))
        continue;
      const { data } = await travelRequest<{
        data: ReservationTicketDocumentV1;
      }>(`reservations/requests/${request.id}/ticket-documents`, {
        customerId: target.passengerId,
        ...(manual ? { number: manual } : {}),
        ...(existing ? { expectedNumber: existing.number } : {}),
      });
      const previous = saved.findIndex(
        (doc) => doc.customerId === data.customerId,
      );
      if (previous < 0) saved.push(data);
      else saved[previous] = data;
      flushSync(() => {
        setDocuments([...saved]);
        setManualNumbers((previous) => ({
          ...previous,
          [data.customerId]: data.number,
        }));
      });
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
                  <input
                    aria-label="E-Ticket No"
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="خودکار"
                    disabled={!canEdit || issuing}
                    className="rounded-lg border border-border bg-surface px-3 py-2"
                    value={
                      manualNumbers[ticket.passengerId] ??
                      documents.find(
                        (doc) => doc.customerId === ticket.passengerId,
                      )?.number ??
                      ''
                    }
                    onChange={(event) =>
                      setManualNumbers({
                        ...manualNumbers,
                        [ticket.passengerId]: event.target.value
                          .replace(/[۰-۹]/g, (digit) =>
                            String(digit.charCodeAt(0) - 1776),
                          )
                          .replace(/[٠-٩]/g, (digit) =>
                            String(digit.charCodeAt(0) - 1632),
                          )
                          .replace(/[^0-9]/g, ''),
                      })
                    }
                  />
                  <Button
                    disabled={!canEdit || issuing || !numberChoices.length}
                    onClick={() => void registerNumber()}
                  >
                    {issuing ? 'در حال ثبت…' : 'ثبت شماره و تاریخ صدور'}
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={
                    !ready ||
                    flightNumbersReady !== flightContextKey ||
                    issuing ||
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
                    flightNumbersReady !== flightContextKey ||
                    issuing ||
                    factsReady !== request ||
                    passengersReady !== request.id ||
                    downloading
                  }
                  onClick={() => void download(true)}
                >
                  دانلود PDF همهٔ مسافران
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
                      publicDocumentUrl: documentUrl(ticket.passengerId),
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
          {printDocument ? (
            <div dangerouslySetInnerHTML={{ __html: printDocument }} />
          ) : (
            (printAll ? tickets : ticket ? [ticket] : []).map((item) => (
              <div key={item.passengerId} data-reservation-ticket-page>
                <FlightTicketSheet
                  data={{
                    ...item,
                    publicDocumentUrl: documentUrl(item.passengerId),
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
            ))
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
