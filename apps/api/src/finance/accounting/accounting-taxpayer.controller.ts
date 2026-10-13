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
import { PermissionGuard } from '../../iam/permission.guard';
import { RequirePermissions } from '../../iam/iam.decorators';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { AccountingTaxpayerService } from './accounting-taxpayer.service';
@Controller('finance/accounting/books/:bookId/taxpayer')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('finance.read', 'finance.journal.read')
export class AccountingTaxpayerController {
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
