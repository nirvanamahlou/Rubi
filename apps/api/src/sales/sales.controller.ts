import { ForbiddenException } from '@nestjs/common';
import { TravelWorkflowService } from '../reservations/travel-workflow.service';
import { FinanceDeliveryService } from '../finance/document-delivery/finance-delivery.module';
import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type {
  SalesContractCommandRequest,
  SalesContractCreateRequest,
  SalesContractListQuery,
  SalesContractUpdateRequest,
  SalesPaymentCreateRequest,
} from '@rubi/contracts';

import { AuthGuard } from '../iam/auth.guard';
import type { AuthenticatedRequest } from '../iam/iam.types';
import { SalesService } from './sales.service';
import { SalesOutputService } from './sales-output.service';
import { SALES_XLSX_MIME } from './sales.xlsx';

@ApiTags('Sales')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard)
@Controller('sales')
export class SalesController {
  constructor(
    @Inject(SalesService) private readonly service: SalesService,
    @Inject(SalesOutputService) private readonly output: SalesOutputService,
    @Inject(TravelWorkflowService)
    private readonly travel: TravelWorkflowService,
    @Inject(FinanceDeliveryService)
    private readonly delivery: FinanceDeliveryService,
  ) {}

  @Get('contracts/:id/travel-documents')
  @Header('Cache-Control', 'private, no-store')
  async travelDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.service.detail(id, req.actor);
    const intake = await this.travel.forContract(id, req.actor.branchIds);
    const authorization = await this.delivery.read(intake.id);
    if (
      !authorization.approved ||
      intake.workflow.supplierStatus === 'CANCELLED'
    )
      throw new ForbiddenException(
        'مدارک مسافر تا تأیید تحویل مدارک توسط مالی در دسترس فروش نیست.',
      );
    return { data: intake, delivery: authorization };
  }
  @Get('contracts/:id/output')
  @Header('Cache-Control', 'private, no-store')
  printOutput(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.output.prepare(id, request.actor, traceId);
  }

  @Get('contracts/export.xlsx')
  @Header('Cache-Control', 'private, no-store')
  async exportXlsx(
    @Query() query: SalesContractListQuery,
    @Req() request: AuthenticatedRequest,
  ) {
    const bytes = await this.service.exportXlsx(query, request.actor);
    return new StreamableFile(bytes, {
      type: SALES_XLSX_MIME,
      disposition: `attachment; filename="sales-contracts-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    });
  }

  @Get('dashboard')
  @Header('Cache-Control', 'private, no-store')
  dashboard(@Req() request: AuthenticatedRequest) {
    return this.service.dashboard(request.actor);
  }

  @Get('contracts')
  @Header('Cache-Control', 'private, no-store')
  list(
    @Query() query: SalesContractListQuery,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.list(query, request.actor);
  }

  @Post('contracts')
  create(
    @Body() input: SalesContractCreateRequest,
    @Req() request: AuthenticatedRequest,
    @Headers('x-branch-id') branchId?: string,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.create(
      input,
      request.actor,
      branchId,
      idempotencyKey,
      traceId,
    );
  }

  @Get('contracts/:id/status-history')
  @Header('Cache-Control', 'private, no-store')
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.history(id, request.actor);
  }

  @Get('contracts/:id/audit')
  @Header('Cache-Control', 'private, no-store')
  audit(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.audit(id, request.actor);
  }

  @Get('contracts/:id')
  @Header('Cache-Control', 'private, no-store')
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.detail(id, request.actor);
  }

  @Patch('contracts/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SalesContractUpdateRequest,
    @Req() request: AuthenticatedRequest,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.update(id, input, request.actor, traceId);
  }

  @Post('contracts/:id/payments')
  addPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SalesPaymentCreateRequest,
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.addPayment(
      id,
      input,
      request.actor,
      idempotencyKey,
      traceId,
    );
  }

  @Post('contracts/:id/confirm')
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SalesContractCommandRequest,
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.confirm(
      id,
      input.version,
      input.reason,
      request.actor,
      idempotencyKey,
      traceId,
    );
  }

  @Post('contracts/:id/reservation-request')
  reservationRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SalesContractCommandRequest,
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.confirm(
      id,
      input.version,
      input.reason,
      request.actor,
      idempotencyKey,
      traceId,
    );
  }

  @Post('contracts/:id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SalesContractCommandRequest,
    @Req() request: AuthenticatedRequest,
    @Headers('x-request-id') traceId?: string,
  ) {
    return this.service.cancel(
      id,
      input.version,
      input.reason,
      request.actor,
      traceId,
    );
  }
}
