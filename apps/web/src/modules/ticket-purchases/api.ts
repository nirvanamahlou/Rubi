import type {
  FinanceTicketCostCommandV1,
  TicketPurchaseInboxItemV1,
} from '@nora/contracts';
import { apiRequest } from '@/modules/finance/api/finance-inbox-api';
export const ticketPurchaseApi = {
  list: () =>
    apiRequest<{
      data: TicketPurchaseInboxItemV1[];
      meta: { canPrice: boolean };
    }>('/procurement/ticket-purchases/inbox'),
  price: (id: string, input: FinanceTicketCostCommandV1) =>
    apiRequest(
      '/procurement/ticket-purchases/' + encodeURIComponent(id) + '/costs',
      { method: 'POST', body: JSON.stringify(input) },
    ),
};
