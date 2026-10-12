import {
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../iam/auth.guard';
import { PermissionGuard } from '../../iam/permission.guard';
import { RequirePermissions } from '../../iam/iam.decorators';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { AccountingCompletionService } from './accounting-completion.service';

@Controller('finance/accounting/books/:bookId/completion')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('finance.read', 'finance.journal.read')
export class AccountingCompletionController {
  constructor(
    @Inject(AccountingCompletionService)
    private readonly service: AccountingCompletionService,
  ) {}
  @Get('journal-lines')
  @Header('Cache-Control', 'private, no-store')
  lines(
    @Param('bookId') bookId: string,
    @Query() query: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.journalLines(bookId, query, request.actor);
  }
  @Get('year-end/:periodId')
  @Header('Cache-Control', 'private, no-store')
  yearEnd(
    @Param('bookId') bookId: string,
    @Param('periodId') periodId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.yearEndReadiness(bookId, periodId, request.actor);
  }
}
