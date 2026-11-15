import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  FinanceFiscalContextV1,
  FinanceFiscalRequestV1,
} from '@nora/contracts';
import { DatabaseService } from '../../database/database.service';
import { AccountingCompanyScope } from '../accounting/accounting-company-scope';
import * as v from '../accounting/accounting.validation';

@Injectable()
export class FinanceFiscalContextService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(AccountingCompanyScope)
    private readonly companies: AccountingCompanyScope,
  ) {}

  async current(actor: AuthenticatedActor): Promise<FinanceFiscalContextV1> {
    const scope = await this.companies.current(actor);
    const book = scope.company
      ? await this.database.client.accountingBook.findFirst({
          // Calendar metadata is company-wide; record reads/writes retain their native branch guards.
          where: { legalEntityId: scope.company.id, active: true },
        })
      : null;
    const periods = book
      ? await this.database.client.accountingPeriod.findMany({
          where: { bookId: book.id, fiscalYear: { kind: 'fiscal-years' } },
          include: { fiscalYear: true },
          orderBy: { startDate: 'desc' },
        })
      : [];
    return {
      company: scope.company,
      companySelection: scope.selection,
      issuerCompanyId: scope.issuerCompanyId,
      isAggregate: scope.isAggregate,
      bookId: book?.id ?? null,
      bookVersion: book?.version ?? null,
      defaultPeriodId:
        periods.find((period) => period.isDefault && period.fiscalYear.active)
          ?.id ?? null,
      periods: periods.map((period) => ({
        id: period.id,
        bookId: period.bookId,
        fiscalYearId: period.fiscalYearId,
        startDate: period.startDate,
        endDate: period.endDate,
        status: period.status as 'OPEN' | 'CLOSING' | 'CLOSED',
        isDefault: period.isDefault,
        version: period.version,
        yearActive: period.fiscalYear.active,
        code: period.fiscalYear.code,
        title: period.fiscalYear.title,
      })),
    };
  }

  async resolve(
    actor: AuthenticatedActor,
    hints: {
      actorId?: string | undefined;
      company?: string | undefined;
      periodId?: string | undefined;
      version?: string | undefined;
      mode?: string | undefined;
    },
  ): Promise<FinanceFiscalRequestV1> {
    if (hints.actorId && hints.actorId !== actor.userId)
      throw new ConflictException(
        'کاربر فعال تغییر کرده است؛ صفحه را دوباره بارگذاری کنید.',
      );
    const context = await this.current(actor);
    if (hints.company && hints.company !== context.companySelection)
      throw new ConflictException({
        code: 'FINANCE_COMPANY_CONTEXT_CHANGED',
        message: 'شرکت فعال تغییر کرده است؛ صفحه را دوباره بارگذاری کنید.',
      });
    const mode = hints.mode === 'temporary' ? 'temporary' : 'default';
    if (hints.mode && !['temporary', 'default'].includes(hints.mode))
      v.invalid('حالت انتخاب سال مالی معتبر نیست.');
    const id =
      mode === 'temporary' ? v.uuid(hints.periodId)! : context.defaultPeriodId;
    if (mode === 'default' && hints.periodId && hints.periodId !== id)
      throw new ConflictException({
        code: 'FINANCE_FISCAL_CONTEXT_CHANGED',
        message:
          'سال مالی پیش‌فرض تغییر کرده است؛ صفحه را دوباره بارگذاری کنید.',
      });
    const period = context.periods.find((row) => row.id === id) ?? null;
    if (id && !period)
      throw new NotFoundException('سال مالی در شرکت فعال در دسترس نیست.');
    if (
      period &&
      hints.version !== undefined &&
      hints.version !== String(period.version)
    )
      throw new ConflictException({
        code: 'FINANCE_FISCAL_CONTEXT_CHANGED',
        message:
          'اطلاعات سال مالی تغییر کرده است؛ صفحه را دوباره بارگذاری کنید.',
      });
    return { ...context, actorId: actor.userId, mode, period };
  }
}
