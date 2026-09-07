'use client';
import { SalesThemedSelect } from './sales-themed-select';

import Image from 'next/image';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plane } from 'lucide-react';
import type { MasterDataRecord, TicketOfferV1 } from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import type { SalesFormState } from '../model/sales-form';
import { salesDirections } from '../model/sales-form';
import styles from './flight-ticket-preview.module.css';

export interface FlightTicketSheetData {
  passengerName: string;
  businessOutput?: boolean;
  contractNumber?: string;
  offers: readonly (Pick<
    TicketOfferV1,
    | 'id'
    | 'originId'
    | 'destinationId'
    | 'departureAt'
    | 'carrierName'
    | 'serviceNumber'
  > & { cabinClassCode: string; businessOutput?: boolean })[];
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
  const offers = [
    salesDirections(state, 'FLIGHT').includes('OUTBOUND')
      ? state.outboundOffer
      : undefined,
    salesDirections(state, 'FLIGHT').includes('RETURN')
      ? state.returnOffer
      : undefined,
  ].filter((item) => item !== undefined);
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

/** Presentation-only public document; issuance is intentionally not inferred. */
export function FlightTicketSheet({
  data,
  cityName,
}: {
  data: FlightTicketSheetData;
  cityName: (id: string) => string;
}) {
  const { offers, passengerName } = data;
  const demo =
    offers.length > 0 &&
    offers.every(
      (offer) =>
        /^TEST-AYT-0[1-4]$/.test(offer.serviceNumber) &&
        /^TEST AIRLINE(?:\s|$)/i.test(offer.carrierName.trim()),
    );
  return (
    <article className={styles.paper} dir="ltr">
      <header className={styles.header}>
        <div>
          <h1>FLIGHT TICKET</h1>
          <div className={styles.rule} />
        </div>
        <Image
          src="/brand/niyayesh-seir-full.png"
          alt="Niyayesh Seir"
          width={210}
          height={140}
          loading="eager"
          unoptimized
        />
      </header>
      <p className={styles.draft}>
        DRAFT — NOT VALID FOR TRAVEL / پیش‌نمایش، فاقد اعتبار سفر
      </p>
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
      {demo ? (
        <p className={styles.sample}>
          SAMPLE DATA — نمونهٔ نمایشی؛ شماره‌ها واقعی و صادرشده نیستند.
        </p>
      ) : null}
      <div className={styles.identity}>
        <div>
          <p>
            Agency Name<strong>NIYAYESH SEIR SAHAR</strong>
          </p>
          <p>
            Airline Name<strong>{offers[0]?.carrierName || '—'}</strong>
          </p>
        </div>
        <div>
          <p>
            Date Of Issue<strong>—</strong>
          </p>
          <p>
            RLOC<strong>{demo ? 'DEMO01' : '—'}</strong>
          </p>
          <p>
            E-Ticket No<strong>{demo ? '7143' : '—'}</strong>
          </p>
        </div>
      </div>
      <p className={styles.passenger}>
        Passenger Name <strong>{passengerName || '—'}</strong>
        {data.businessOutput || offers.some((offer) => offer.businessOutput) ? (
          <b className={styles.business}>BUSINESS</b>
        ) : null}
      </p>
      {data.contractNumber ? (
        <p className={styles.passenger}>
          Contract <strong>{data.contractNumber}</strong>
        </p>
      ) : null}
      {data.transferDirections.length ? (
        <p className={styles.passenger}>
          TRANSFER INCLUDED:{' '}
          <strong>{data.transferDirections.join(' / ')}</strong>
        </p>
      ) : null}
      <section className={styles.section}>
        <h3>
          <i>1</i> FLIGHT INFORMATION
        </h3>
        <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                {[
                  'Date',
                  'Flight No',
                  'Departure',
                  'Arrival',
                  'Time (UTC)',
                  'Class',
                  'Status',
                  'Bag',
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.id}>
                  <td>{offer.departureAt.slice(0, 10)}</td>
                  <td>{offer.serviceNumber}</td>
                  <td>{cityName(offer.originId)}</td>
                  <td>{cityName(offer.destinationId)}</td>
                  <td>{offer.departureAt.slice(11, 16)}</td>
                  <td>
                    {offer.businessOutput ? 'BUSINESS' : offer.cabinClassCode}
                  </td>
                  <td>DRAFT</td>
                  <td>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className={styles.section}>
        <h3>
          <i>2</i> NOTICE
        </h3>
        <p>
          NOTICE 1: This preview is not an issued ticket. Reservation
          confirmation, ticket number, airport codes and baggage must come from
          the issuing system.
        </p>
        <p dir="rtl">
          اطلاعات صدور در این پیش‌نمایش تأیید نشده‌اند. درج بیزینس فقط برچسب
          خروجی انتخاب‌شده است.
        </p>
      </section>
      <footer>
        حضور در فرودگاه ۳ ساعت قبل از پرواز الزامی است.
        <br />
        <strong>
          PRESENCE 03:00 BEFORE FLIGHT TIME AT THE AIRPORT IS MANDATORY
        </strong>
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
          {open ? 'بستن پیش‌نمایش' : 'پیش‌نمایش قالب بلیت'}
        </Button>
        {open ? (
          <>
            <SalesThemedSelect
              label="مسافر پیش‌نمایش بلیت"
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
