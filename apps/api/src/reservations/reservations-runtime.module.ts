import {
  Controller,
  Body,
  Headers,
  Param,
  Post,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Module,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IamModule } from '../iam/iam.module';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { ReservationsPublicService } from './reservations-public.service';
import { ReservationHotelPurchaseService } from './reservation-hotel-purchase.service';
import type { ReservationHotelPurchaseInputV1 } from '@rubi/contracts';

@Controller('reservations/requests')
@UseGuards(AuthGuard)
class ReservationRequestsController {
  constructor(
    @Inject(ReservationsPublicService)
    private readonly service: ReservationsPublicService,
    @Inject(ReservationHotelPurchaseService)
    private readonly hotelPurchase: ReservationHotelPurchaseService,
  ) {}
  @Post(':id/hotel-purchase')
  @Header('Cache-Control', 'private, no-store')
  record(
    @Param('id') id: string,
    @Body() input: ReservationHotelPurchaseInputV1,
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.hotelPurchase.record(id, input, req.actor, key);
  }
  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(@Req() req: AuthenticatedRequest) {
    if (!req.actor.permissions.includes('reservations.read'))
      throw new ForbiddenException('مجوز مشاهده رزرواسیون وجود ندارد.');
    return { version: 1, data: await this.service.list(req.actor.branchIds) };
  }
}
@Module({
  imports: [IamModule],
  controllers: [ReservationRequestsController],
  providers: [
    AuthGuard,
    ReservationsPublicService,
    ReservationHotelPurchaseService,
  ],
  exports: [ReservationsPublicService],
})
export class ReservationsRuntimeModule {}
