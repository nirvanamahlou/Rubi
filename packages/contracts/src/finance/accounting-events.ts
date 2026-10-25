/** Versioned read projection; source facts and amounts are never client-editable. */
export interface AccountingFinancialEventV1 {
  id: string;
  source: string;
  basisEventId?: string;
  carryingAmount?: string;
  carryingCurrency?: string;
  kind: string;
  requestId: string;
  trackingNumber?: string;
  trackingDate?: string;
  reference: string | null;
  amount: string;
  currency: string;
  occurredAt: string;
  createdAt: string;
  lastError: string | null;
  journal: {
    id: string;
    bookId: string;
    status: string;
    version?: number;
  } | null;
}
export interface AccountingFinancialEventPageV1 {
  version: 1;
  items: AccountingFinancialEventV1[];
  nextCursor: string | null;
}

export const accountingFinancialEventLabels: Record<string, string> = {
  SALES_CONTRACT_CONFIRMED: 'تعهد قرارداد فروش تأییدشده',
  CUSTOMER_RECEIPT: 'دریافت قرارداد',
  RECEIPT_ALLOCATION: 'تخصیص دریافت به قرارداد',
  RECEIPT_ALLOCATION_REVERSAL: 'برگشت تخصیص دریافت',
  PETTY_CASH_ADVANCE_PAYMENT: 'تأمین اولیه تنخواه',
  PETTY_CASH_TOPUP_PAYMENT: 'شارژ مجدد تنخواه',
  PETTY_CASH_EXPENSE_POSTED: 'هزینه تأییدشده تنخواه',
  PETTY_CASH_RETURN_PAYMENT: 'بازگشت وجه تنخواه',
  SUPPLIER_INVOICE_APPROVED: 'تعهد فاکتور خرید تأییدشده',
  TICKET_PAYABLE: 'تعهد خرید قطعی بلیت',
  RESERVATION_PAYABLE: 'تعهد خرید خدمات رزرواسیون',
  PAYROLL_NET_APPROVED: 'حقوق خالص تأییدشده',
  COMMISSION_APPROVED: 'تعهد کمیسیون تأییدشده',
  ADJUSTMENT_APPROVED: 'تعهد اصلاح مالی تأییدشده',
  SUPPLIER_PAYMENT: 'پرداخت فاکتور خرید',
  TICKET_PAYMENT: 'پرداخت خرید بلیت',
  RESERVATION_PAYMENT: 'پرداخت رزرواسیون',
  PAYROLL_PAYMENT: 'پرداخت حقوق',
  REFUND_PAYMENT: 'استرداد وجه',
  COMMISSION_PAYMENT: 'پرداخت کارمزد',
  CHECK_PAYMENT: 'پرداخت چک',
  ADJUSTMENT_PAYMENT: 'پرداخت اصلاحی',
};
