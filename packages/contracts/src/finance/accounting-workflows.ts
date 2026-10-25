/** Manual, evidence-backed accounting completion. Decimal amounts remain strings. */
export const accountingWorkflowLabels: Record<string, string> = {
  REVENUE: 'درآمد و کارمزد',
  PAYROLL: 'حقوق ناخالص',
  PURCHASE_OUTCOME: 'نتیجه خرید و استعلام',
  SUPPLIER_REFUND: 'استرداد وجه خرید ناموفق',
  PURCHASE_WRITE_OFF: 'زیان قطعی خرید ناموفق',
  FX_SETTLEMENT: 'تسویه ارزی پرداخت',
};
export interface AccountingWorkflowSourcesV1 {
  contracts: { id: string; version: number; label: string }[];
  payroll: {
    net: { id: string; version: number; label: string }[];
    gross: { id: string; label: string }[];
  };
  payments: { id: string; label: string }[];
  truncated: boolean;
}
export interface AccountingWorkflowV1 {
  id: string;
  kind: string;
  amount: string;
  currency: string;
  occurredAt: string;
  reference: string;
  cancelled: boolean;
  actorId: string;
  facts: Record<string, unknown>;
  journal: { id: string; status: string; version: number } | null;
}
export interface AccountingWorkflowPageV1 {
  items: AccountingWorkflowV1[];
  truncated: boolean;
}
