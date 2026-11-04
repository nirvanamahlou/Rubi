import {
  salesContractFlights,
  type SalesContractOutputV1,
} from '@nora/contracts';
import { readTicketDocumentFacts } from '@/modules/ticket-catalog/public/document-details';

export function readContractFlightFacts(
  output: SalesContractOutputV1,
  get: (path: string) => Promise<Response>,
) {
  return readTicketDocumentFacts(
    salesContractFlights(
      output.contract.servicesDetail,
      output.contract.ticketSelections,
    ),
    (path) =>
      get(path.replace('/master-data/', '/master-data/selections/sales/')),
  );
}
