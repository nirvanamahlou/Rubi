import {
  Body,
  Controller,
  Headers,
  Inject,
  Module,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { TicketCatalogPurchaseCreateV1 } from '@nora/contracts';

import { AuthGuard } from '../iam/auth.guard';
import { IamModule } from '../iam/iam.module';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { ProcurementPublicService } from './procurement-public.service';

@Controller('procurement/ticket-purchases')
@UseGuards(AuthGuard)
class ProcurementTicketPurchasesController {
  constructor(
    @Inject(ProcurementPublicService)
    private readonly service: ProcurementPublicService,
  ) {}

  @Post()
  register(
    @Body() input: TicketCatalogPurchaseCreateV1,
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.registerTicketPurchase(input, req.actor, branchId, key);
  }
}

@Module({
  imports: [IamModule],
  controllers: [ProcurementTicketPurchasesController],
  providers: [AuthGuard, ProcurementPublicService],
  exports: [ProcurementPublicService],
})
export class ProcurementModule {}
