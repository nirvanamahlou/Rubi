import { toursApi } from '@/modules/ticket-catalog/api/tours';
/** Pricing lists only flights whose departure time has not passed, using the server clock. */
export const loadTicketPricingOffers = (signal?: AbortSignal) =>
  signal ? toursApi.managedOffers(false, signal) : toursApi.managedOffers();
