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
  StreamableFile,
} from '@nestjs/common';
import { AuthGuard } from '../../iam/auth.guard';
import { PermissionGuard } from '../../iam/permission.guard';
import { RequirePermissions } from '../../iam/iam.decorators';
import type { AuthenticatedRequest } from '../../iam/iam.types';
import { accountingXlsx, ACCOUNTING_XLSX_MIME } from './accounting.xlsx';
import { AccountingService } from './accounting.service';
import {
  displayText,
  requestDisplayLanguage,
} from '../../common/i18n/language';

@Controller('finance/accounting')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('finance.read', 'finance.journal.read')
export class AccountingController {
  constructor(
    @Inject(AccountingService) private readonly accounting: AccountingService,
  ) {}
  @Get('books')
  @Header('Cache-Control', 'private, no-store')
  books(@Req() request: AuthenticatedRequest) {
    return this.accounting.books(request.actor);
  }
  @Post('books')
  @RequirePermissions('finance.read', 'finance.account.manage')
  create(@Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.accounting.createBook(body, request.actor);
  }
  @Get('books/:bookId')
  @Header('Cache-Control', 'private, no-store')
  snapshot(@Param('bookId') id: string, @Req() request: AuthenticatedRequest) {
    return this.accounting.snapshot(id, request.actor);
  }
  @Get('books/:bookId/journals')
  @Header('Cache-Control', 'private, no-store')
  journals(
    @Param('bookId') id: string,
    @Query() query: Record<string, string>,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.accounting.journals(id, query, request.actor);
  }
  @Get('books/:bookId/reports/trial-balance')
  @Header('Cache-Control', 'private, no-store')
  report(
    @Param('bookId') id: string,
    @Query() query: Record<string, string>,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.accounting.report(id, query, request.actor);
  }
  @Get('books/:bookId/reports/trial-balance/export')
  @Header('Cache-Control', 'private, no-store')
  @RequirePermissions('finance.read', 'finance.journal.read', 'finance.export')
  async exportReport(
    @Param('bookId') id: string,
    @Query() query: Record<string, string>,
    @Req() request: AuthenticatedRequest,
  ) {
    const report = await this.accounting.report(id, query, request.actor);
    const language = requestDisplayLanguage(request);
    return new StreamableFile(
      accountingXlsx(
        displayText('تراز حساب‌ها', language),
        [
          'کد',
          'حساب',
          'مانده اول دوره',
          'بدهکار',
          'بستانکار',
          'مانده پایان',
        ].map((label) => displayText(label, language)),
        report.rows.map((r) => [
          r.code,
          r.title,
          r.opening,
          r.debit,
          r.credit,
          r.balance,
        ]),
        language === 'fa',
      ),
      {
        type: ACCOUNTING_XLSX_MIME,
        disposition: 'attachment; filename="accounting-trial-balance.xlsx"',
      },
    );
  }
  @Get('books/:bookId/reports/turnover')
  @Header('Cache-Control', 'private, no-store')
  turnover(
    @Param('bookId') id: string,
    @Query() query: Record<string, string>,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.accounting.turnover(id, query, request.actor);
  }
  @Get('books/:bookId/reports/analytical/:kind')
  @Header('Cache-Control', 'private, no-store')
  analytical(
    @Param('bookId') id: string,
    @Param('kind') kind: string,
    @Query() query: Record<string, string>,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.accounting.analyticalReport(id, kind, query, request.actor);
  }
  @Get('books/:bookId/journals/:journalId/events')
  @Header('Cache-Control', 'private, no-store')
  journalEvents(
    @Param('bookId') id: string,
    @Param('journalId') journalId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.accounting.journalEvents(id, journalId, request.actor);
  }
  @Get('books/:bookId/sources')
  @Header('Cache-Control', 'private, no-store')
  sources(
    @Param('bookId') id: string,
    @Query() query: Record<string, string>,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.accounting.sourceHistory(id, query, request.actor);
  }
  @Post('books/:bookId/actions/:action')
  command(
    @Param('bookId') id: string,
    @Param('action') action: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.accounting.command(id, action, body, request.actor);
  }
}
