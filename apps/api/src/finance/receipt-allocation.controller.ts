import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { RequirePermissions } from '../iam/iam.decorators';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { FinanceReceiptAllocationService } from './operations/receipt-allocation.service';
@Controller('finance/receipt-allocations')
@UseGuards(AuthGuard, PermissionGuard)
export class FinanceReceiptAllocationController {
  constructor(
    @Inject(FinanceReceiptAllocationService)
    private readonly allocation: FinanceReceiptAllocationService,
  ) {}
  @Get(':eventId')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('finance.read', 'finance.journal.read')
  async context(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query('before') before: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return { data: await this.allocation.context(eventId, req.actor, before) };
  }
  @Get(':eventId/targets')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('finance.read', 'finance.journal.read')
  async targets(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query('search') search: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return { data: await this.allocation.targets(eventId, search, req.actor) };
  }
  @Post(':eventId')
  @RequirePermissions(
    'finance.read',
    'finance.receipt.approve',
    'finance.journal.create',
  )
  async create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() input: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return { data: await this.allocation.command(eventId, input, req.actor) };
  }
  @Post(':eventId/:allocationId/reverse')
  @RequirePermissions(
    'finance.read',
    'finance.receipt.approve',
    'finance.journal.create',
  )
  async reverse(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('allocationId', ParseUUIDPipe) allocationId: string,
    @Body() input: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return {
      data: await this.allocation.command(
        eventId,
        input,
        req.actor,
        allocationId,
      ),
    };
  }
}
