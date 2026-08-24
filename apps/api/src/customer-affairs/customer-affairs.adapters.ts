import type {
  CustomerDetail,
  CustomerListQuery,
  CustomerListResponse,
} from '@rubi/contracts';

import type { CustomerAffairsActorContext } from './customer-affairs.application';
import type {
  CustomerReference,
  SalesRequestReference,
} from './customer-affairs.contracts';
import type { SalesHandoffRequested } from './customer-affairs.integration-contracts';

/** Read-only anti-corruption port backed only by the public Customers contract. */
export interface CustomerAffairsCustomersAdapter {
  search(
    query: CustomerListQuery,
    actor: CustomerAffairsActorContext,
  ): Promise<CustomerListResponse>;
  getCustomer360(
    customerId: string,
    actor: CustomerAffairsActorContext,
  ): Promise<CustomerDetail | null>;
  toReference(customer: CustomerDetail): CustomerReference;
}

/** Proposal-only port. Implementations must not perform a Sales mutation in this phase. */
export interface CustomerAffairsSalesAdapter {
  previewHandoff(
    proposal: SalesHandoffRequested,
    actor: CustomerAffairsActorContext,
  ): Promise<{ proposalReference: string; persisted: false }>;
}

/** Proposal-only resolver for future links owned by Reservations. */
export interface CustomerAffairsReservationsAdapter {
  previewServiceLinks(
    reference: SalesRequestReference,
    actor: CustomerAffairsActorContext,
  ): Promise<{ reference: SalesRequestReference; persisted: false }>;
}
