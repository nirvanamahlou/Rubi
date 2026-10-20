import { toursApi } from '@/modules/ticket-catalog/api/tours';
/** Pricing manages registered history too; the UI's explicit dates filter it. */
export const loadTicketPricingOffers = () => toursApi.managedOffers(true);
