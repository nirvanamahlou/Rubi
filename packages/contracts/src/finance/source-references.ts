import type { SalesContractDetail } from '../sales';

/** Exact persisted relationships. Display numbers must never be used as lookup IDs. */
export interface FinanceSourceReferencesV1 {
  contracts: { id: string; number: string }[];
  journals: {
    id: string;
    bookId: string;
    periodId: string | null;
    number: number | null;
    auxiliaryNumber?: string | null;
    documentDate: string | null;
    status: string;
  }[];
}

export interface FinanceContractReadV1 {
  contract: SalesContractDetail;
}

export interface FinanceJournalReadV1 {
  id: string;
  bookId: string;
  bookTitle: string;
  periodTitle: string | null;
  number: number | null;
  auxiliaryNumber: string | null;
  baseCurrency: string;
  debit: string;
  credit: string;
  documentDate: string | null;
  description: string;
  reference: string | null;
  status: string;
  lines: {
    position: number;
    account: { code: string; title: string } | null;
    details: { level: number; code: string; title: string }[];
    description: string;
    debit: string;
    credit: string;
    currency: string | null;
    foreignAmount: string | null;
    rate: string | null;
  }[];
}
