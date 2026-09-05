import { Inject, Injectable } from '@nestjs/common';
import type {
  AuthenticatedActor,
  SalesTicketSelectionInput,
} from '@rubi/contracts';

import { CustomerService } from '../customers/customer.service';
import { TicketPublicService } from '../ticket-catalog/ticket-public.service';

export const SALES_TICKET_AVAILABILITY_PORT = Symbol(
  'SALES_TICKET_AVAILABILITY_PORT',
);

export interface SalesTicketAvailabilityPort {
  revalidate(
    offerIds: readonly string[],
    branchId: string,
    selections?: readonly SalesTicketSelectionInput[],
  ): Promise<{ available: boolean; unavailableOfferIds: readonly string[] }>;
}

@Injectable()
export class SalesTicketsPublicAdapter implements SalesTicketAvailabilityPort {
  constructor(
    @Inject(TicketPublicService) private readonly catalog: TicketPublicService,
  ) {}
  revalidate(
    offerIds: readonly string[],
    branchId: string,
    selections?: readonly SalesTicketSelectionInput[],
  ) {
    return this.catalog.revalidate(offerIds, branchId, selections);
  }
}

@Injectable()
export class AwaitingTicketCatalogPublicApi implements SalesTicketAvailabilityPort {
  async revalidate(offerIds: readonly string[]) {
    return { available: offerIds.length === 0, unavailableOfferIds: offerIds };
  }
}

@Injectable()
export class SalesCustomersPublicAdapter {
  constructor(
    @Inject(CustomerService) private readonly customers: CustomerService,
  ) {}

  async resolveSnapshot(customerId: string, actor: AuthenticatedActor) {
    const response = await this.customers.maskedDetail(customerId, actor);
    return { id: response.data.id, displayName: response.data.displayName };
  }
}
