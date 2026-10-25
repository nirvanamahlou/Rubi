import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  printFixture,
  printReferences,
} from '@/modules/sales/model/contract-print.fixture';
import { contractPrintHtml } from '@/modules/sales/model/contract-print';
import { FlightTicketSheet } from '@/modules/sales/public/tickets';
import { reservationTickets } from '../model/reservation-tickets';
import type { SalesReservationRequestV1 } from '@nora/contracts';
import {
  amendmentFromContract,
  withAmendmentBusinessOutput,
} from './contract-amendment-model';
import { ReservationSalesAmendment } from './reservation-sales-amendment';

it.each([true, false])(
  'reopens the business checkbox from the saved flag (%s)',
  (checked) => {
    const d = withAmendmentBusinessOutput(
      amendmentFromContract(printFixture.contract),
      checked,
    );
    const html = renderToStaticMarkup(
      <ReservationSalesAmendment
        contract={{ ...printFixture.contract, servicesDetail: d.services }}
        section="FLIGHT"
        onSaved={vi.fn()}
      />,
    );
    expect(html).toContain('این بلیط بیزینس است');
    const control = html.match(/<input[^>]*type="checkbox"[^>]*>/)?.[0];
    expect(control).toBeDefined();
    expect(control!.includes('checked=""')).toBe(checked);
    expect(html).toContain('ثبت اصلاح قرارداد');
  },
);

it.each([true, false])(
  'uses the amended flag in current contract and reservation ticket output (%s)',
  (checked) => {
    const output = structuredClone(printFixture);
    const d = withAmendmentBusinessOutput(
      amendmentFromContract(output.contract),
      checked,
    );
    output.contract.servicesDetail = d.services;
    const contractHtml = contractPrintHtml(output, printReferences);
    expect(contractHtml.includes('BUSINESS')).toBe(checked);
    const snapshot: SalesReservationRequestV1 = {
      version: 1,
      requestId: 'request',
      contractId: output.contract.id,
      contractNumber: output.contract.contractNumber,
      contractVersion: output.contract.version,
      createdAt: output.generatedAt,
      customerId: output.contract.customerId,
      passengerIds: d.passengers.map((p) => p.customerId),
      passengerAssignments: output.contract.passengersDetail,
      serviceSelections: d.services,
      ticketSelections: d.ticketSelections ?? [],
      selectedTicketOfferIds: d.ticketSelections!.map((t) => t.offerId),
      hotelSelection: null,
    };
    const tickets = reservationTickets(snapshot);
    expect(tickets[0]!.offers.map((o) => o.businessOutput)).toEqual([
      checked,
      checked,
    ]);
    expect(
      renderToStaticMarkup(
        <FlightTicketSheet data={tickets[0]!} cityName={(id) => id} />,
      ).includes('BUSINESS'),
    ).toBe(checked);
    expect(output.contract.ticketSelections).toEqual(
      printFixture.contract.ticketSelections,
    );
  },
);
