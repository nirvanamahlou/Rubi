import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Inject,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { FlightLoadService } from './flight-load.service';
import { flightLoadWorkbook } from './flight-load.xlsx';
import { SALES_XLSX_MIME } from './sales.xlsx';
import { requestDisplayLanguage } from '../common/i18n/language';

@Controller('sales/flight-load')
@UseGuards(AuthGuard)
export class FlightLoadController {
  constructor(
    @Inject(FlightLoadService) private readonly service: FlightLoadService,
  ) {}

  @Get(':offerId/contracts')
  @Header('Cache-Control', 'private, no-store')
  contracts(
    @Param('offerId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Query('cancelled', new ParseBoolPipe({ optional: true }))
    cancelled?: boolean,
  ) {
    return this.service.contracts(id, req.actor, cancelled);
  }

  @Get(':offerId/contracts.xlsx')
  @Header('Cache-Control', 'private, no-store')
  async workbook(
    @Param('offerId', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Query('cancelled', new ParseBoolPipe({ optional: true }))
    cancelled?: boolean,
  ) {
    if (!req.actor.permissions.includes('sales.export'))
      throw new ForbiddenException('مجوز خروجی قراردادها وجود ندارد.');
    const report = await this.service.contracts(id, req.actor, cancelled);
    return new StreamableFile(
      flightLoadWorkbook(report, requestDisplayLanguage(req)),
      {
        type: SALES_XLSX_MIME,
        disposition: `attachment; filename="flight-load-${id}.xlsx"`,
      },
    );
  }
}
