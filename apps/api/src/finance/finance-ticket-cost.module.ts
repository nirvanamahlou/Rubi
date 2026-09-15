import {
  Body,
  Controller,
  Inject,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  FinanceTicketCostCommandV1,
  FinanceTicketPaymentCommandV1,
} from '@nora/contracts';
import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import { PermissionGuard } from '../iam/permission.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { ProcurementModule } from '../procurement/procurement.module';
import { FinanceTicketCostService } from './ticket-cost/finance-ticket-cost.service';

@Controller('finance/ticket-purchases')
@UseGuards(AuthGuard, PermissionGuard)
class FinanceTicketCostController {
  constructor(
    @Inject(FinanceTicketCostService)
    private readonly costs: FinanceTicketCostService,
  ) {}

  @Post(':requestId/costs')
  @RequirePermissions('finance.payment.create')
  async cost(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() input: FinanceTicketCostCommandV1,
    @Req() req: AuthenticatedRequest,
  ) {
    return { data: await this.costs.recordCost(requestId, input, req.actor) };
  }

  @Post(':requestId/payments')
  @RequirePermissions('finance.payment.create')
  async payment(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() input: FinanceTicketPaymentCommandV1,
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      data: await this.costs.recordPayment(requestId, input, req.actor),
    };
  }
}

@Module({
  imports: [IamModule, ProcurementModule],
  controllers: [FinanceTicketCostController],
  providers: [AuthGuard, PermissionGuard, FinanceTicketCostService],
  exports: [FinanceTicketCostService],
})
export class FinanceTicketCostModule {}
