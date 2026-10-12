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
import { AccountingTaxService } from './accounting-tax.service';

@Controller('finance/accounting/books/:bookId/tax')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('finance.read', 'finance.journal.read')
export class AccountingTaxController {
  @Post(':kind/:id/delete')
  @RequirePermissions('finance.read', 'finance.account.manage')
  remove(
    @Param('bookId') bookId: string,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.remove(bookId, kind, id, body, request.actor);
  }
  constructor(
    @Inject(AccountingTaxService)
    private readonly service: AccountingTaxService,
  ) {}
  @Get(':kind')
  @Header('Cache-Control', 'private, no-store')
  list(
    @Param('bookId') bookId: string,
    @Param('kind') kind: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.list(bookId, kind, request.actor);
  }
  @Post(':kind')
  @RequirePermissions('finance.read', 'finance.account.manage')
  save(
    @Param('bookId') bookId: string,
    @Param('kind') kind: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.save(bookId, kind, body, request.actor);
  }
}
