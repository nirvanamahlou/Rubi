export interface FinanceReceiptAllocationContextV1 {
  version: 1;
  eventId: string;
  sourcePaymentId: string;
  sourceContractId: string;
  sourceContractNumber: string;
  sourceVersion: number;
  currency: string;
  availableAmount: string;
  reservedRefunds: string;
  accountingReady: boolean;
  accountingIssue: string | null;
  allocations: readonly {
    id: string;
    targetContractId: string;
    targetContractNumber: string;
    targetVersion: number;
    amount: string;
    reason: string;
    createdAt: string;
    reversed: boolean;
  }[];
  nextCursor: string | null;
}
export interface FinanceReceiptAllocationTargetV1 {
  id: string;
  contractNumber: string;
  version: number;
  outstanding: string;
}
export interface FinanceReceiptAllocationCommandV1 {
  operationId: string;
  targetContractId?: string;
  amount?: string;
  reason: string;
  expectedSourceVersion: number;
  expectedTargetVersion: number;
}
export interface FinanceReceiptAllocationResultV1 {
  id: string;
  status: 'ALLOCATED' | 'REVERSED';
}
