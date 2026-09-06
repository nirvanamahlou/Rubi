import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Module,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { ReservationArrangementUpdateV1 } from '@rubi/contracts';
import { IamModule } from '../iam/iam.module';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { ReservationsPublicService } from './reservations-public.service';

@Controller('reservations/requests')
@UseGuards(AuthGuard)
class ReservationRequestsController {
  constructor(
    @Inject(ReservationsPublicService)
    private readonly service: ReservationsPublicService,
  ) {}
  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(@Req() req: AuthenticatedRequest) {
    if (!req.actor.permissions.includes('reservations.read'))
      throw new ForbiddenException('مجوز مشاهده رزرواسیون وجود ندارد.');
    return { version: 1, data: await this.service.list(req.actor.branchIds) };
  }

  @Patch(':id/arrangement')
  @Header('Cache-Control', 'private, no-store')
  async updateArrangement(
    @Param('id') id: string,
    @Body() input: ReservationArrangementUpdateV1,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.actor.permissions.includes('reservations.arrangements.update'))
      throw new ForbiddenException('مجوز ویرایش چیدمان رزرواسیون وجود ندارد.');
    return {
      version: 1,
      data: await this.service.updateArrangement(
        id,
        input,
        req.actor.branchIds,
        req.actor.userId,
      ),
    };
  }
}
@Module({
  imports: [IamModule],
  controllers: [ReservationRequestsController],
  providers: [AuthGuard, ReservationsPublicService],
  exports: [ReservationsPublicService],
})
export class ReservationsRuntimeModule {}
