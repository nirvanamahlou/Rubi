'use client';
import { SalesThemedSelect } from './sales-themed-select';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { MasterDataRecord, TicketOfferV1 } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import type { SalesFormState } from '../model/sales-form';
import { salesDirections, salesFlightSelection } from '../model/sales-form';
import {
  ticketPageHtml,
  ticketLayoutStyles,
  type TicketLayoutFlight,
  type TicketLayoutAirline,
} from '@/components/travel/flight-ticket-layout';
import styles from './flight-ticket-preview.module.css';

export interface FlightTicketSheetData {
  branding?: { name: string; logo: string; companyCode?: string };
  airlines?: Readonly<Record<string, TicketLayoutAirline>>;
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
    offerId?: string | undefined;
    originAirport?: TicketLayoutFlight['originAirport'];
    destinationAirport?: TicketLayoutFlight['destinationAirport'];
    baggageKg?: string | null | undefined;
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
  const cities = Object.fromEntries(
    data.offers
      .flatMap((offer) => [offer.originId, offer.destinationId])
      .map((id) => [id, cityName(id)]),
  );
  const brand = {
    name: data.branding?.name ?? 'Niyayesh Seir',
    logoDataUrl: data.branding?.logo ?? '/brand/niyayesh-seir-full.png',
    companyCode: data.branding?.companyCode ?? 'NIYAYESH_SEIR_SAHAR',
  };
  const pages = Array.from(
    { length: Math.max(1, Math.ceil(data.offers.length / 2)) },
    (_, page) =>
      ticketPageHtml(
        data,
        cities,
        brand,
        data.airlines,
        data.offers.slice(page * 2, page * 2 + 2),
      ),
  ).join('');
  return (
    <div dir="ltr">
      <style>{ticketLayoutStyles}</style>
      <div dangerouslySetInnerHTML={{ __html: pages }} />
    </div>
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
