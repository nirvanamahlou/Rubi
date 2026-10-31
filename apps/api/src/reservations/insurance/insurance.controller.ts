import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../iam/auth.guard';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { InsuranceSettingsService } from '../../integrations/insurance/insurance-settings';
import { ReservationInsuranceService } from './insurance.service';

@Controller('reservations/insurance')
@UseGuards(AuthGuard)
export class ReservationInsuranceController {
  constructor(
    @Inject(ReservationInsuranceService)
    private readonly insurance: ReservationInsuranceService,
    @Inject(InsuranceSettingsService)
    private readonly settings: InsuranceSettingsService,
  ) {}
  @Header('Cache-Control', 'private, no-store')
  @Get('policies')
  list(
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.insurance.list(query, req.actor);
  }
  @Header('Cache-Control', 'private, no-store')
  @Get('candidates')
  candidates(@Query('search') search = '', @Req() req: AuthenticatedRequest) {
    return this.insurance.candidates(search, req.actor);
  }
  @Header('Cache-Control', 'private, no-store')
  @Put('draft')
  save(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    return this.insurance.saveDraft(body, req.actor);
  }
  @Header('Cache-Control', 'private, no-store')
  @Get('policies/:id/history')
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.insurance.history(id, req.actor);
  }
  @Header('Cache-Control', 'private, no-store')
  @Get('settings')
  readSettings(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.settings.read(branchId, req.actor);
  }
  @Header('Cache-Control', 'private, no-store')
  @Put('settings')
  writeSettings(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.settings.save(branchId, body, req.actor);
  }
  @Header('Cache-Control', 'private, no-store')
  @Get('references')
  references(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Query('resource') resource: string,
    @Query('page') page = '1',
    @Req() req: AuthenticatedRequest,
  ) {
    return this.settings.references(
      branchId,
      req.actor,
      resource,
      Number(page),
    );
  }
}
