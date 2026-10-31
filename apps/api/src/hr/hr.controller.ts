import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile, UseInterceptors } from '@nestjs/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { HrService } from './hr.service';

@ApiTags('Human Resources')
@ApiCookieAuth('nora_access')
@UseGuards(AuthGuard)
@Controller('hr')
export class HrController {
  constructor(@Inject(HrService) private readonly service: HrService) {}
  @Get('reports/attendance-data')
  @Header('Cache-Control', 'private, no-store')
  attendanceReportData(
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.attendanceReportData(query, req.actor);
  }
  @Get('dashboard/charts')
  @Header('Cache-Control', 'private, no-store')
  dashboardCharts(
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.dashboardCharts(query, req.actor);
  }
  @Get('bootstrap') @Header('Cache-Control', 'private, no-store') bootstrap(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.bootstrap(req.actor);
  }
  @Get('records') @Header('Cache-Control', 'private, no-store') list(
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.listRecords(query, req.actor);
  }
  @Get('records/:id') @Header('Cache-Control', 'private, no-store') detail(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.getRecord(id, req.actor);
  }
  @Post('employees') createEmployee(
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createEmployee(body, key, req.actor);
  }
  @Patch('employees/:id') updateEmployee(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateEmployee(id, body, req.actor);
  }
  @Delete('employees/:id') deleteEmployee(
    @Param('id') id: string,
    @Query('version') version: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.deleteEmployee(id, version, req.actor);
  }
  @Post('records') createRecord(
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createRecord(body, key, req.actor);
  }
  @Patch('records/:id') updateRecord(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateRecord(id, body, req.actor);
  }
  @Post('records/:id/contract-state') contractState(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.contractState(id, body, key, req.actor);
  }
  @Delete('records/:id') deleteRecord(
    @Param('id') id: string,
    @Query('version') version: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.deleteRecord(id, version, req.actor);
  }
  @Get('notifications')
  @Header('Cache-Control', 'private, no-store')
  notifications(@Req() req: AuthenticatedRequest) {
    return this.service.notifications(req.actor);
  }
  @Post('notifications/:id/read') read(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.readNotification(id, req.actor);
  }
  @Get('audit') @Header('Cache-Control', 'private, no-store') audit(
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.auditEvents(query, req.actor);
  }
  @Get('leave/balances') @Header('Cache-Control', 'private, no-store') balances(
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.leaveBalances(query, req.actor);
  }
  @Post('leave/grants') grant(
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.grantLeave(body, key, req.actor);
  }
  @Post('attendance/process') process(
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.processAttendance(body, key, req.actor);
  }
  @Post('attendance/close') close(
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.closeAttendance(body, key, req.actor);
  }
  @Post('workflows/process') workflows(
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.processWorkflows(body, key, req.actor);
  }
  @Post('leave/minutes') minuteLeave(
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.minuteLeave(body, key, req.actor);
  }
  @Get('leave/personnel')
  @Header('Cache-Control', 'private, no-store')
  leavePersonnel(@Req() req: AuthenticatedRequest) {
    return this.service.leavePersonnel(req.actor);
  }
  @Get('leave/report')
  @Header('Cache-Control', 'private, no-store')
  leaveReport(
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.leaveReport(query, req.actor);
  }
  @Get('leave/cardex')
  @Header('Cache-Control', 'private, no-store')
  minuteCardex(
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.minuteCardex(query, req.actor);
  }
  @Post('backup') @Header('Cache-Control', 'private, no-store') backup(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.backup(req.actor);
  }

  @Post('payslips/import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 3 },
    }),
  )
  payslipsImport(
    @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.importPayslips(file, body, key, req.actor);
  }

  @Post('shifts/:id/calendar') calendar(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.saveTemplateCalendar(id, body, key, req.actor);
  }
  @Post('shifts/:id/assign') assignTemplate(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.assignTemplate(id, body, key, req.actor);
  }
}
