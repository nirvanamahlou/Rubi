import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
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
import { ProcurementService, procurementBoundary } from './procurement.service';
import { ProcurementExports } from './procurement.exports';

@ApiTags('Procurement v1')
@ApiCookieAuth('rubi_access')
@UseGuards(AuthGuard)
@Controller('procurement')
export class ProcurementController {
  constructor(
    @Inject(ProcurementService) private readonly service: ProcurementService,
    @Inject(ProcurementExports) private readonly exports: ProcurementExports,
  ) {}
  @Post('exports')
  @HttpCode(202)
  exportCreate(
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return procurementBoundary(() => this.exports.create(body, key, req.actor));
  }
  @Get('exports')
  @Header('Cache-Control', 'private, no-store')
  exportList(
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    return procurementBoundary(() => this.exports.list(query, req.actor));
  }
  @Get('exports/:id')
  @Header('Cache-Control', 'private, no-store')
  exportDetail(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return procurementBoundary(() => this.exports.detail(id, req.actor));
  }
  @Get('bootstrap')
  @Header('Cache-Control', 'private, no-store')
  bootstrap(@Req() req: AuthenticatedRequest) {
    return procurementBoundary(() => this.service.bootstrap(req.actor));
  }
  @Get('reports')
  @Header('Cache-Control', 'private, no-store')
  report(
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    return procurementBoundary(() => this.service.report(query, req.actor));
  }
  @Get('owners')
  @Header('Cache-Control', 'private, no-store')
  owners(
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    return procurementBoundary(() => this.service.owners(query, req.actor));
  }
  @Get('requesters')
  @Header('Cache-Control', 'private, no-store')
  requesters(
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    return procurementBoundary(() => this.service.requesters(query, req.actor));
  }
  @Get('units')
  @Header('Cache-Control', 'private, no-store')
  units(
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    return procurementBoundary(() => this.service.units(query, req.actor));
  }
  @Get('requests')
  @Header('Cache-Control', 'private, no-store')
  list(
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    return procurementBoundary(() => this.service.list(query, req.actor));
  }
  @Get('suppliers')
  @Header('Cache-Control', 'private, no-store')
  suppliers(
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    return procurementBoundary(() => this.service.suppliers(query, req.actor));
  }
  @Get('requests/:id')
  @Header('Cache-Control', 'private, no-store')
  detail(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return procurementBoundary(() => this.service.detail(id, req.actor));
  }
  @Get('requests/:id/records')
  @Header('Cache-Control', 'private, no-store')
  records(
    @Param('id') id: string,
    @Query() query: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    return procurementBoundary(() =>
      this.service.records(id, query, req.actor),
    );
  }
  @Post('requests')
  create(
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return procurementBoundary(() => this.service.create(body, key, req.actor));
  }
  @Patch('requests/:id')
  update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return procurementBoundary(() =>
      this.service.update(id, body, key, req.actor),
    );
  }
  @Post('requests/:id/commands')
  command(
    @Param('id') id: string,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return procurementBoundary(() =>
      this.service.command(id, body, key, req.actor),
    );
  }
}
