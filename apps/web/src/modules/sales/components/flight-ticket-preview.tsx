'use client';
import { SalesThemedSelect } from './sales-themed-select';

import Image from 'next/image';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plane } from 'lucide-react';
import type { MasterDataRecord, TicketOfferV1 } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import type { SalesFormState } from '../model/sales-form';
import { salesDirections, salesFlightSelection } from '../model/sales-form';
import styles from './flight-ticket-preview.module.css';

export interface FlightTicketSheetData {
  branding?: { name: string; logo: string };
  issued?: boolean;
  passengerName: string;
  ageCategory?: 'ADT' | 'CHD' | 'INF';
  gender?: 'M' | 'F' | null;
  businessOutput?: boolean;
  contractNumber?: string;
  offers: readonly (Pick<
    TicketOfferV1,
    | 'id'
    | 'originId'
    | 'destinationId'
    | 'departureAt'
    | 'arrivalAt'
    | 'carrierName'
    | 'serviceNumber'
  > & {
    cabinClassCode: string;
    businessOutput?: boolean;
    contractOnly?: boolean;
    direction?: 'OUTBOUND' | 'RETURN';
  })[];
  transferDirections: readonly string[];
}

export function FlightTicketDocument({
  state,
  cities,
  passengerName,
}: {
  state: SalesFormState;
  cities: readonly MasterDataRecord[];
  passengerName: string;
}) {
  const city = (id: string) => {
    const record = cities.find((item) => item.id === id);
    return String(record?.attributes.englishName || record?.name || '—');
  };
  const offers = salesDirections(state, 'FLIGHT').flatMap((direction) => {
    const flight = salesFlightSelection(state, direction);
    return flight
      ? [
          {
            id: flight.serviceClientKey,
            originId: flight.originId,
            destinationId: flight.destinationId,
            departureAt: flight.departureAt,
            arrivalAt: flight.arrivalAt,
            direction,
            carrierName: flight.carrierNameSnapshot,
            serviceNumber: flight.serviceNumberSnapshot,
            cabinClassCode: flight.cabinClassCode,
            contractOnly: flight.source === 'CONTRACT_ONLY',
          },
        ]
      : [];
  });
  return (
    <FlightTicketSheet
      data={{
        passengerName,
        businessOutput: state.businessOutput === true,
        offers: offers.map((offer) => ({
          ...offer,
          businessOutput: state.businessOutput === true,
        })),
        transferDirections: state.serviceKinds.includes('TRANSFER')
          ? salesDirections(state, 'TRANSFER')
          : [],
      }}
      cityName={city}
    />
  );
}

/** Presentation-only public document; reservation outputs explicitly mark issuance. */
export function FlightTicketSheet({
  data,
  cityName,
}: {
  data: FlightTicketSheetData;
  cityName: (id: string) => string;
}) {
  const { offers, passengerName } = data;
  const passengerPrefix =
    data.ageCategory === 'INF'
      ? 'INF'
      : data.ageCategory === 'CHD'
        ? 'CHD'
        : data.gender === 'F'
          ? 'MRS'
          : data.gender === 'M'
            ? 'MR'
            : '';
  const passengerLabel = [passengerPrefix, passengerName]
    .filter(Boolean)
    .join(' ');
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tehran',
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
      .format(new Date(value))
      .toUpperCase();
  const formatTime = (value: string) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tehran',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(value));
  const demo =
    offers.length > 0 &&
    offers.every(
      (offer) =>
        !offer.contractOnly &&
        /^TEST-AYT-0[1-4]$/.test(offer.serviceNumber) &&
        /^TEST AIRLINE(?:\s|$)/i.test(offer.carrierName.trim()),
    );
  return (
    <article className={styles.paper} dir="ltr">
      <header className={styles.header}>
        <div>
          <h1>FLIGHT TICKET</h1>
          <p>ELECTRONIC TICKET / ITINERARY</p>
        </div>
        {(!data.branding || data.branding.logo) && (
          <Image
            src={data.branding?.logo ?? '/brand/niyayesh-seir-full.png'}
            alt={data.branding?.name ?? 'Niyayesh Seir'}
            width={210}
            height={140}
            loading="eager"
            unoptimized
          />
        )}
      </header>
      {!data.issued ? (
        <p className={styles.draft}>
          DRAFT — NOT VALID FOR TRAVEL / پیش‌نمایش، فاقد اعتبار سفر
        </p>
      ) : null}
      <div className={styles.airlineBrand}>
        {demo ? (
          <span
            className={styles.airlineLogo}
            role="img"
            aria-label="TEST AIRLINE — لوگوی آزمایشی"
          >
            <Plane size={42} strokeWidth={1.6} />
          </span>
        ) : null}
        <h2 className={styles.airline}>
          {[...new Set(offers.map((item) => item.carrierName))].join(' / ') ||
            'AIRLINE'}
        </h2>
      </div>
      {demo && !data.issued ? (
        <p className={styles.sample}>
          SAMPLE DATA — نمونهٔ نمایشی؛ شماره‌ها واقعی و صادرشده نیستند.
        </p>
      ) : null}
      <section className={styles.identity}>
        <div>
          <span>PASSENGER</span>
          <strong>{passengerLabel || '—'}</strong>
        </div>
        <div>
          <span>BOOKING REFERENCE / RLOC</span>
          <strong>{data.contractNumber || (demo ? 'DEMO01' : '—')}</strong>
        </div>
        {!data.issued ? (
          <div className={styles.draftMeta}>
            <span>E-Ticket No</span>
            <strong>{demo ? '7143' : '—'}</strong>
          </div>
        ) : null}
      </section>
      <p className={styles.outputFlags}>
        {data.businessOutput || offers.some((offer) => offer.businessOutput) ? (
          <b className={styles.business}>BUSINESS</b>
        ) : null}
      </p>
      {data.transferDirections.length ? (
        <p className={styles.passenger}>
          TRANSFER INCLUDED:{' '}
          <strong>{data.transferDirections.join(' / ')}</strong>
        </p>
      ) : null}
      <div className={styles.legs}>
        {offers.map((offer, index) => {
          const direction =
            offer.direction === 'RETURN'
              ? 'RETURN'
              : index === 0
                ? 'OUTBOUND'
                : 'FLIGHT';
          const cabin = offer.businessOutput
            ? 'BUSINESS'
            : offer.cabinClassCode;
          return (
            <section
              key={offer.id}
              className={`${styles.leg} ${direction === 'RETURN' ? styles.returnLeg : ''}`}
            >
              <div className={styles.legHead}>
                <strong>✈ &nbsp; {direction}</strong>
                <span>{formatDate(offer.departureAt)}</span>
                <span>{cabin} CLASS</span>
              </div>
              <div className={styles.route}>
                <div className={styles.place}>
                  <span>FROM</span>
                  <strong>{cityName(offer.originId)}</strong>
                  <b>{formatTime(offer.departureAt)}</b>
                </div>
                <div className={styles.flightPath}>
                  <Plane size={32} strokeWidth={1.7} />
                  <i />
                  <small>
                    {offer.carrierName} · {offer.serviceNumber || '—'}
                  </small>
                </div>
                <div className={`${styles.place} ${styles.destination}`}>
                  <span>TO</span>
                  <strong>{cityName(offer.destinationId)}</strong>
                  <b>{offer.arrivalAt ? formatTime(offer.arrivalAt) : '—'}</b>
                </div>
              </div>
              <div className={styles.legFoot}>
                <div>
                  <span>CLASS</span>
                  <strong>{cabin}</strong>
                </div>
                <div>
                  <span>STATUS</span>
                  <strong>
                    {data.issued
                      ? 'ISSUED'
                      : offer.contractOnly
                        ? 'PENDING RESERVATION'
                        : 'DRAFT'}
                  </strong>
                </div>
                <div>
                  <span>FLIGHT NO.</span>
                  <strong>{offer.serviceNumber || '—'}</strong>
                </div>
              </div>
            </section>
          );
        })}
      </div>
      {!data.issued ? (
        <p className={styles.notice}>
          FLIGHT INFORMATION / NOTICE — All times are shown in Tehran time.
          Reservation confirmation, ticket number, airport codes and baggage
          must come from the issuing system.
        </p>
      ) : null}
      <div className={styles.warning}>
        <strong>
          PRESENCE 03:00 BEFORE FLIGHT TIME AT THE AIRPORT IS MANDATORY
        </strong>
        <strong dir="rtl">
          حضور در فرودگاه ۳ ساعت قبل از پرواز الزامی است.
        </strong>
      </div>
      <footer className={styles.footer}>
        <span>FLY FURTHER TOGETHER</span>
        <span>{data.branding?.name ?? 'NIYAYESH SEIR SAHAR'}</span>
      </footer>
    </article>
  );
}

export function FlightTicketPreview({
  state,
  cities,
}: {
  state: SalesFormState;
  cities: readonly MasterDataRecord[];
}) {
  const [open, setOpen] = useState(false);
  const [passengerIndex, setPassengerIndex] = useState(0);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'بستن پیش‌نمایش' : 'پیش‌نمایش قالب بلیط'}
        </Button>
        {open ? (
          <>
            <SalesThemedSelect
              label="مسافر پیش‌نمایش بلیط"
              value={String(passengerIndex)}
              disabled={!state.passengers.length}
              onValueChange={(value) => setPassengerIndex(Number(value))}
              options={state.passengers.map((passenger, index) => ({
                value: String(index),
                label: passenger.displayName,
              }))}
            />
            <Button type="button" onClick={() => window.print()}>
              چاپ پیش‌نمایش
            </Button>
          </>
        ) : null}
      </div>
      {open ? (
        <div className={styles.viewport}>
          <FlightTicketDocument
            state={state}
            cities={cities}
            passengerName={state.passengers[passengerIndex]?.displayName ?? ''}
          />
        </div>
      ) : null}
      {open
        ? createPortal(
            <div data-flight-print className={styles.printOnly}>
              <style media="print">
                {
                  'body > :not([data-flight-print]) { display: none !important; } body { margin: 0 !important; padding: 0 !important; }'
                }
              </style>
              <FlightTicketDocument
                state={state}
                cities={cities}
                passengerName={
                  state.passengers[passengerIndex]?.displayName ?? ''
                }
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
