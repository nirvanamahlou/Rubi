'use client';

import Image from 'next/image';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { MasterDataRecord } from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import type { SalesFormState } from '../model/sales-form';
import { salesDirections } from '../model/sales-form';
import styles from './flight-ticket-preview.module.css';

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
    <article className={styles.paper} dir="ltr">
      <header className={styles.header}>
        <div>
          <h1>FLIGHT TICKET</h1>
          <div className={styles.rule} />
        </div>
        <Image
          src="/brand/niyayesh-seir-full.png"
          alt="Niyayesh Seir"
          width={165}
          height={110}
          unoptimized
        />
      </header>
      <p className={styles.draft}>
        DRAFT — NOT VALID FOR TRAVEL / پیش‌نمایش، فاقد اعتبار سفر
      </p>
      <h2 className={styles.airline}>
        {[...new Set(offers.map((item) => item.carrierName))].join(' / ') ||
          'AIRLINE'}
      </h2>
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
            RLOC<strong>—</strong>
          </p>
          <p>
            E-Ticket No<strong>—</strong>
          </p>
        </div>
      </div>
      <p className={styles.passenger}>
        Passenger Name <strong>{passengerName || '—'}</strong>
        {state.businessOutput ? (
          <b className={styles.business}>BUSINESS</b>
        ) : null}
      </p>
      {state.serviceKinds.includes('TRANSFER') ? (
        <p className={styles.passenger}>
          TRANSFER INCLUDED:{' '}
          <strong>{salesDirections(state, 'TRANSFER').join(' / ')}</strong>
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
                  <td>{city(offer.originId)}</td>
                  <td>{city(offer.destinationId)}</td>
                  <td>{offer.departureAt.slice(11, 16)}</td>
                  <td>
                    {state.businessOutput ? 'BUSINESS' : offer.cabinClassCode}
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
          <i>2</i> FARE &amp; PAYMENT DETAILS
        </h3>
        <dl>
          {[
            'Restrictions',
            'Form Of Payment',
            'Fare Base',
            'Tax/Fee/Charge',
            'Total',
          ].map((label) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>—</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className={styles.section}>
        <h3>
          <i>3</i> NOTICE
        </h3>
        <p>
          NOTICE 1: This preview is not an issued ticket. Reservation
          confirmation, ticket number, airport codes, baggage and fare details
          must come from the issuing system.
        </p>
        <p dir="rtl">
          اطلاعات صدور و پرداخت در این پیش‌نمایش تأیید نشده‌اند. درج بیزینس فقط
          برچسب خروجی انتخاب‌شده است.
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
            <select
              aria-label="مسافر پیش‌نمایش بلیت"
              className="rounded-xl border bg-surface p-2"
              value={passengerIndex}
              onChange={(event) =>
                setPassengerIndex(Number(event.target.value))
              }
            >
              {state.passengers.map((passenger, index) => (
                <option key={passenger.customerId} value={index}>
                  {passenger.displayName}
                </option>
              ))}
            </select>
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
