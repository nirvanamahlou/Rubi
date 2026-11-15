import type {
  AccountingLedgerCompanyV1,
  AccountingPeriodV1,
} from '../accounting';

export interface FinanceFiscalPeriodV1 extends AccountingPeriodV1 {
  yearActive: boolean;
  code: string;
  title: string;
}

/** Shared default; personal temporary choices are deliberately not persisted. */
export interface FinanceFiscalContextV1 {
  issuerCompanyId: string | null;
  company: AccountingLedgerCompanyV1 | null;
  companySelection: string;
  isAggregate: boolean;
  bookId: string | null;
  bookVersion: number | null;
  defaultPeriodId: string | null;
  periods: FinanceFiscalPeriodV1[];
}

export interface FinanceFiscalRequestV1 extends FinanceFiscalContextV1 {
  actorId: string;
  period: FinanceFiscalPeriodV1 | null;
  mode: 'default' | 'temporary';
}
