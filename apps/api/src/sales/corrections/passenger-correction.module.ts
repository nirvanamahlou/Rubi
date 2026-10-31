import { ContractNoticeService } from './contract-notice.service';
import { ContractNoticeController } from './contract-notice.controller';
import { ContractPriceCorrectionService } from './contract-price-correction.service';
import { PassengerCompletionService } from './passenger-completion.service';
import type { SalesPassengerCompletionCommandV1 } from '@nora/contracts';
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
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CustomerMutationDto } from '../../customers/customer.dto';
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
    @Inject(PassengerCompletionService)
    private readonly completion: PassengerCompletionService,
  ) {}
  @Get(':id/passenger-completion')
  @Header('Cache-Control', 'private, no-store')
  completionForm(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.completion.form(id, req.actor);
  }
  @Post(':id/passenger-completion')
  completePassengers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SalesPassengerCompletionCommandV1,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.completion.save(id, input, req.actor);
  }
  @Post(':id/passenger-completion/people')
  createCompletionPerson(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CustomerMutationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.completion.createPerson(id, input, req.actor);
  }
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
  controllers: [PassengerCorrectionController, ContractNoticeController],
  providers: [
    ContractNoticeService,
    PassengerCompletionService,
    PassengerCorrectionService,
    PassengerCorrectionCrypto,
    ContractPriceCorrectionService,
  ],
  exports: [PassengerCorrectionService],
})
export class PassengerCorrectionModule {}
