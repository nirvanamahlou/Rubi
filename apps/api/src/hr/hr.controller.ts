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
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard)
@Controller('hr')
export class HrController {
  constructor(@Inject(HrService) private readonly service: HrService) {}
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
}
