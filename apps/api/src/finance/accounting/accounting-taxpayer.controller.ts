import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../iam/auth.guard';
import { PermissionGuard } from '../../iam/permission.guard';
import { RequirePermissions } from '../../iam/iam.decorators';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { AccountingTaxpayerService } from './accounting-taxpayer.service';
@Controller('finance/accounting/books/:bookId/taxpayer')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('finance.read', 'finance.journal.read')
export class AccountingTaxpayerController {
  @Get('drafts/:kind')
  @Header('Cache-Control', 'private, no-store')
  drafts(
    @Param('bookId') id: string,
    @Param('kind') kind: string,
    @Query() query: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.drafts(id, kind, query, request.actor);
  }
  @Post('drafts/:kind')
  @RequirePermissions('finance.read', 'finance.account.manage')
  saveDraft(
    @Param('bookId') id: string,
    @Param('kind') kind: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.saveDraft(id, kind, body, request.actor);
  }
  constructor(
    @Inject(AccountingTaxpayerService)
    private readonly service: AccountingTaxpayerService,
  ) {}
  @Get('seller')
  @Header('Cache-Control', 'private, no-store')
  @Header('Content-Type', 'application/json')
  async seller(
    @Param('bookId') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    // Nest sends a bare null as an empty body; the client expects valid JSON.
    return JSON.stringify(await this.service.seller(id, request.actor));
  }
  @Post('seller')
  @RequirePermissions('finance.read', 'finance.account.manage')
  save(
    @Param('bookId') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.saveSeller(id, body, request.actor);
  }
}
