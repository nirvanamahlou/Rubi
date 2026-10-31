import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { HrPayrollWorksheetService } from './hr-payroll-worksheet.service';

@Controller('hr/payroll-worksheets')
@UseGuards(AuthGuard)
export class HrPayrollWorksheetController {
  constructor(
    @Inject(HrPayrollWorksheetService)
    private readonly service: HrPayrollWorksheetService,
  ) {}
  @Get('configuration/:branchId/:employeeId')
  @Header('Cache-Control', 'private, no-store')
  configuration(
    @Param('branchId') branch: string,
    @Param('employeeId') employee: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.configuration(branch, employee, req.actor);
  }
  @Post('configuration/:branchId/:employeeId') saveConfiguration(
    @Param('branchId') branch: string,
    @Param('employeeId') employee: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.configuration(branch, employee, req.actor, body);
  }
  @Get() @Header('Cache-Control', 'private, no-store') list(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.list(req.actor);
  }
  @Get(':id') @Header('Cache-Control', 'private, no-store') detail(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.detail(id, req.actor);
  }
  @Get(':id/status') @Header('Cache-Control', 'private, no-store') status(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.status(id, req.actor);
  }
  @Post() create(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    return this.service.create(body, req.actor);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(id, body, req.actor);
  }
  @Post(':id/approve') approve(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.transition(id, body, req.actor, true);
  }
  @Post(':id/reopen') reopen(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.transition(id, body, req.actor, false);
  }
}
