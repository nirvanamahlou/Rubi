import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { SalesService } from './sales.service';
import { ReservationsPublicService } from '../reservations/reservations-public.service';
import { FinanceTicketCostService } from '../finance/ticket-cost/finance-ticket-cost.service';
import { contractProfit } from './sales-profit';

@Injectable()
export class SalesProfitService {
  constructor(
    @Inject(SalesService) private readonly sales: SalesService,
    @Inject(ReservationsPublicService)
    private readonly reservations: ReservationsPublicService,
    @Inject(FinanceTicketCostService)
    private readonly finance: FinanceTicketCostService,
  ) {}
  async detail(id: string, actor: AuthenticatedActor) {
    if (!actor.permissions.includes('finance.read'))
      throw new ForbiddenException(
        'مجوز مشاهده هزینه و سود قرارداد وجود ندارد.',
      );
    const { data: contract } = await this.sales.detail(id, actor);
    if (!actor.branchIds.includes(contract.branchId))
      throw new ForbiddenException('شعبه قرارداد در دسترس نیست.');
    const [intake, tickets] = await Promise.all([
      this.reservations.contractPurchaseContext(id, contract.branchId),
      this.finance.recordedCostsForOffers(
        contract.ticketSelections.map((s) => s.offerId),
        contract.branchId,
      ),
    ]);
    return { data: contractProfit(contract, intake, tickets) };
  }
}
