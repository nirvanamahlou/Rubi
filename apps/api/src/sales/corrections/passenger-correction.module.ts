import { ContractPriceCorrectionService } from './contract-price-correction.service';
import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { SalesPassengerCorrectionCommandV1 } from '@nora/contracts';
import { CustomersModule } from '../../customers/customers.module';
import { IamModule } from '../../iam/iam.module';
import { AuthGuard } from '../../iam/auth.guard';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { NotificationsModule } from '../../notifications/notifications.module';
import { PassengerCorrectionCrypto } from './passenger-correction.crypto';
import { PassengerCorrectionService } from './passenger-correction.service';

@Controller('sales/contracts')
@UseGuards(AuthGuard)
export class PassengerCorrectionController {
  constructor(
    @Inject(PassengerCorrectionService)
    private readonly service: PassengerCorrectionService,
    @Inject(ContractPriceCorrectionService)
    private readonly prices: ContractPriceCorrectionService,
  ) {}
  @Get(':id/price-correction')
  @Header('Cache-Control', 'private, no-store')
  priceForm(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.prices.form(id, req.actor);
  }
  @Post(':id/price-correction')
  correctPrice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.prices.save(id, input, req.actor);
  }
  @Get(':id/passenger-corrections/form')
  @Header('Cache-Control', 'private, no-store')
  form(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.form(id, req.actor);
  }
  @Get(':id/passenger-corrections')
  @Header('Cache-Control', 'private, no-store')
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Query('cursor') cursor?: string,
    @Query('eventId') eventId?: string,
  ) {
    return this.service.history(id, req.actor, cursor, eventId);
  }
  @Post(':id/passenger-corrections')
  correct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SalesPassengerCorrectionCommandV1,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.correct(id, input, req.actor);
  }
}
@Module({
  imports: [IamModule, CustomersModule, NotificationsModule],
  controllers: [PassengerCorrectionController],
  providers: [
    PassengerCorrectionService,
    PassengerCorrectionCrypto,
    ContractPriceCorrectionService,
  ],
  exports: [PassengerCorrectionService],
})
export class PassengerCorrectionModule {}
