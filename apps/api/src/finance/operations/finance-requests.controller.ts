import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../iam/auth.guard';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { FinancePayrollService } from './finance-payroll.service';

@Controller('finance/requests')
@UseGuards(AuthGuard)
export class FinanceRequestsController {
  constructor(
    @Inject(FinancePayrollService)
    private readonly service: FinancePayrollService,
  ) {}
  @Post() @Header('Cache-Control', 'private, no-store') create(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createManual(body, req.actor);
  }
  @Get(':id') @Header('Cache-Control', 'private, no-store') detail(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.detail(id, req.actor);
  }
  @Post(':id/action') @Header('Cache-Control', 'private, no-store') action(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.action(id, body, req.actor);
  }
}
