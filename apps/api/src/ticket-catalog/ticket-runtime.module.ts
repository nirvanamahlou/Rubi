import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Module,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { TicketOfferCreateV1, TicketOfferSearchV1 } from '@rubi/contracts';
import { IamModule } from '../iam/iam.module';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { TicketPublicService } from './ticket-public.service';

@Controller('ticket-catalog/offers')
@UseGuards(AuthGuard)
class TicketOffersController {
  constructor(
    @Inject(TicketPublicService) private readonly service: TicketPublicService,
  ) {}
  @Get() search(
    @Query() query: TicketOfferSearchV1,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.search(query, req.actor);
  }
  @Post() publish(
    @Body() input: TicketOfferCreateV1,
    @Req() req: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.service.publish(input, req.actor, branchId, key);
  }
}

@Module({
  imports: [IamModule],
  controllers: [TicketOffersController],
  providers: [AuthGuard, TicketPublicService],
  exports: [TicketPublicService],
})
export class TicketRuntimeModule {}
