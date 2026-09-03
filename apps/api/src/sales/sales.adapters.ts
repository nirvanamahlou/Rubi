import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';

import { CustomerService } from '../customers/customer.service';

export const SALES_TICKET_AVAILABILITY_PORT = Symbol('SALES_TICKET_AVAILABILITY_PORT');

export interface SalesTicketAvailabilityPort {
  revalidate(offerIds: readonly string[]): Promise<{ available: boolean; unavailableOfferIds: readonly string[] }>;
}

@Injectable()
export class AwaitingTicketCatalogPublicApi implements SalesTicketAvailabilityPort {
  async revalidate(offerIds: readonly string[]) {
    return { available: offerIds.length === 0, unavailableOfferIds: offerIds };
  }
}

@Injectable()
export class SalesCustomersPublicAdapter {
  constructor(@Inject(CustomerService) private readonly customers: CustomerService) {}

  async resolveSnapshot(customerId: string, actor: AuthenticatedActor) {
    const response = await this.customers.maskedDetail(customerId, actor);
    return { id: response.data.id, displayName: response.data.displayName };
  }
}
