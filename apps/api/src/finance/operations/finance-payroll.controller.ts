import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../iam/auth.guard';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { FinancePayrollService } from './finance-payroll.service';

@Controller('hr/payroll-finance')
@UseGuards(AuthGuard)
export class FinancePayrollController {
  constructor(
    @Inject(FinancePayrollService)
    private readonly payroll: FinancePayrollService,
  ) {}
  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  detail(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.payroll.detail(id, req.actor);
  }
  @Post(':id/action')
  @Header('Cache-Control', 'private, no-store')
  action(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.payroll.action(id, body, req.actor);
  }
  @Post()
  @Header('Cache-Control', 'private, no-store')
  submit(
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.payroll.submit(body, key, req.actor);
  }
}
