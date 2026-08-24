export const FINANCE_CONTRACT_VERSION = 'finance.v1-proposal' as const;
export const FINANCE_API_PREFIX = '/api/v1/finance' as const;
export const FINANCE_FOUNDATION_NOTICE =
  'Decision-gated proposal; no persistence, no posting, no authoritative FX, no approval workflow, and no financial release execution is active.' as const;

export const financeCurrencyCodes = [
  'IRR',
  'USD',
  'EUR',
  'TRY',
  'AED',
] as const;
export type FinanceCurrencyCode = (typeof financeCurrencyCodes)[number];

export interface MoneyContract {
  /** Canonical decimal string; consumers must not parse this as a floating number. */
  amount: string;
  currencyCode: FinanceCurrencyCode;
}

export interface FinancePublicReference {
  module:
    'CUSTOMERS' | 'SALES' | 'RESERVATIONS' | 'PURCHASES' | 'HR' | 'MASTER_DATA';
  type: string;
  id: string;
  version?: number;
  displaySnapshot?: string;
}

export interface ExchangeRateContract {
  id: string;
  baseCurrencyCode: FinanceCurrencyCode;
  quoteCurrencyCode: FinanceCurrencyCode;
  rate: string;
  sourceReference: string;
  validAt: string;
  status: 'DRAFT' | 'APPROVED';
  approvedByReference: string | null;
  approvedAt: string | null;
}

export type FinanceDocumentStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'POSTED'
  | 'REVERSED'
  | 'CANCELLED';

export type FinancialReleaseStatus = 'BLOCKED' | 'CONDITIONAL' | 'APPROVED';
export type FinancialReleaseBasis =
  | 'FULL_SETTLEMENT'
  | 'APPROVED_CREDIT'
  | 'APPROVED_PAYMENT_PLAN'
  | 'VALID_CHECK'
  | 'MANAGER_EXCEPTION';

export type CheckDirection = 'RECEIVABLE' | 'PAYABLE';
export type CheckStatus =
  | 'RECEIVED'
  | 'DEPOSITED'
  | 'CLEARED'
  | 'BOUNCED'
  | 'RETURNED'
  | 'ENDORSED'
  | 'ISSUED'
  | 'DELIVERED'
  | 'DUE'
  | 'PAID'
  | 'CANCELLED';

export interface FinanceActorContract {
  actorReference: string;
  branchReference: string;
  legalEntityReference: string;
  permissions: readonly string[];
}

export interface FinanceListQuery {
  search: string;
  branchReference: string | null;
  fiscalPeriodReference: string | null;
  currencyCode: FinanceCurrencyCode | 'ALL';
  status: string;
  partyReference: string | null;
  sortBy: 'createdAt' | 'updatedAt' | 'dueAt' | 'amount';
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface FinancePage<T> {
  data: readonly T[];
  meta: { page: number; pageSize: number; total: number };
}

export interface JournalLineContract {
  accountReference: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: MoneyContract;
  baseAmount: MoneyContract;
  partyReference?: FinancePublicReference;
  costCenterReference?: string;
  projectReference?: string;
  contractReference?: FinancePublicReference;
}

export interface JournalDraftContract {
  legalEntityReference: string;
  fiscalPeriodReference: string;
  documentDate: string;
  description: string;
  sourceReference: FinancePublicReference | null;
  lines: readonly JournalLineContract[];
  idempotencyKey: string;
  expectedVersion: number;
}

export interface FinancialReleaseEvaluationContract {
  contractReference: FinancePublicReference;
  documentReferences: readonly FinancePublicReference[];
  requestedStatus: FinancialReleaseStatus;
  basis: FinancialReleaseBasis;
  reason: string;
  exceptionExpiresAt: string | null;
  secondApproverReference: string | null;
  expectedVersion: number;
  idempotencyKey: string;
}

export interface ApprovalRequestContract {
  operationType:
    'PURCHASE' | 'PAYMENT' | 'REFUND' | 'MANUAL_JOURNAL' | 'RELEASE_EXCEPTION';
  amount: MoneyContract;
  branchReference: string;
  makerReference: string;
  checkerReference: string | null;
  reason: string;
}

export interface FinanceEventEnvelope<TType extends string, TPayload> {
  eventId: string;
  eventType: TType;
  version: 1;
  occurredAt: string;
  traceId: string;
  actorReference: string | null;
  aggregateId: string;
  payload: TPayload;
}

export type SalesContractActivatedV1 = FinanceEventEnvelope<
  'sales.contract.activated',
  {
    contractReference: FinancePublicReference;
    payerReference: FinancePublicReference;
    passengerReferences: readonly FinancePublicReference[];
    serviceReferences: readonly FinancePublicReference[];
    saleTotal: MoneyContract;
    paymentTermsReference: string;
  }
>;

export type SalesContractAmendedV1 = FinanceEventEnvelope<
  'sales.contract.amended',
  {
    contractReference: FinancePublicReference;
    previousVersion: number;
    currentVersion: number;
    saleTotal: MoneyContract;
  }
>;

export type ReservationDocumentIssuedV1 = FinanceEventEnvelope<
  'reservation.travel_document.issued',
  {
    contractReference: FinancePublicReference;
    serviceReference: FinancePublicReference;
    documentReference: FinancePublicReference;
    passengerReferences: readonly FinancePublicReference[];
  }
>;

export type PurchaseInvoiceApprovedV1 = FinanceEventEnvelope<
  'purchase.invoice_approved',
  {
    purchaseInvoiceReference: FinancePublicReference;
    supplierReference: FinancePublicReference;
    contractReference: FinancePublicReference | null;
    serviceReference: FinancePublicReference | null;
    grossPurchase: MoneyContract;
    supplierDiscount: MoneyContract;
    feesAndCosts: MoneyContract;
    netPurchase: MoneyContract;
  }
>;

export type CustomerReferenceResolvedV1 = FinanceEventEnvelope<
  'customer.reference.resolved',
  {
    customerReference: FinancePublicReference;
    displaySnapshot: string;
    status: 'ACTIVE' | 'INACTIVE';
  }
>;

export type HrPayrollInputApprovedV1 = FinanceEventEnvelope<
  'employee.payroll_input_approved',
  {
    payrollBatchReference: FinancePublicReference;
    payableTotal: MoneyContract;
    itemCount: number;
  }
>;

export type FinanceInboundEventV1 =
  | SalesContractActivatedV1
  | SalesContractAmendedV1
  | ReservationDocumentIssuedV1
  | PurchaseInvoiceApprovedV1
  | CustomerReferenceResolvedV1
  | HrPayrollInputApprovedV1;

export type PaymentConfirmedV1 = FinanceEventEnvelope<
  'finance.payment.confirmed',
  {
    paymentReference: string;
    contractReference: FinancePublicReference | null;
    amount: MoneyContract;
  }
>;

export type FinancialReleaseChangedV1 = FinanceEventEnvelope<
  'finance.financial_release.changed',
  {
    contractReference: FinancePublicReference;
    documentReferences: readonly FinancePublicReference[];
    status: FinancialReleaseStatus;
    basis: FinancialReleaseBasis;
    expiresAt: string | null;
  }
>;

export type CheckDueSoonV1 = FinanceEventEnvelope<
  'finance.check.due_soon',
  {
    checkReference: string;
    direction: CheckDirection;
    dueAt: string;
    amount: MoneyContract;
    partyReference: FinancePublicReference;
  }
>;

export type FinanceOutboundEventV1 =
  PaymentConfirmedV1 | FinancialReleaseChangedV1 | CheckDueSoonV1;

export type FinanceAction =
  | 'workspace.read'
  | 'journal.read'
  | 'journal.create'
  | 'journal.approve'
  | 'receipt.create'
  | 'payment.create'
  | 'payment.approve'
  | 'refund.create'
  | 'refund.approve'
  | 'check.manage'
  | 'settlement.manage'
  | 'exchange_rate.read'
  | 'exchange_rate.approve'
  | 'financial_release.read'
  | 'financial_release.approve'
  | 'financial_release.override'
  | 'export.request';

export const financePermissionMatrix: Readonly<Record<FinanceAction, string>> =
  {
    'workspace.read': 'finance.read',
    'journal.read': 'finance.journal.read',
    'journal.create': 'finance.journal.create',
    'journal.approve': 'finance.journal.approve',
    'receipt.create': 'finance.receipt.create',
    'payment.create': 'finance.payment.create',
    'payment.approve': 'finance.payment.approve',
    'refund.create': 'finance.refund.create',
    'refund.approve': 'finance.refund.approve',
    'check.manage': 'finance.check.manage',
    'settlement.manage': 'finance.settlement.manage',
    'exchange_rate.read': 'finance.exchange_rate.read',
    'exchange_rate.approve': 'finance.exchange_rate.approve',
    'financial_release.read': 'finance.financial_release.read',
    'financial_release.approve': 'finance.financial_release.approve',
    'financial_release.override': 'finance.financial_release.override',
    'export.request': 'finance.export',
  };

export function hasFinancePermission(
  grantedPermissions: readonly string[],
  action: FinanceAction,
): boolean {
  return grantedPermissions.includes(financePermissionMatrix[action]);
}

export const financeEndpointProposals = {
  dashboard: `${FINANCE_API_PREFIX}/dashboard`,
  journals: `${FINANCE_API_PREFIX}/journals`,
  receipts: `${FINANCE_API_PREFIX}/receipts`,
  payments: `${FINANCE_API_PREFIX}/payments`,
  transfers: `${FINANCE_API_PREFIX}/transfers`,
  checks: `${FINANCE_API_PREFIX}/checks`,
  invoices: `${FINANCE_API_PREFIX}/invoices`,
  settlements: `${FINANCE_API_PREFIX}/settlements`,
  exchangeRates: `${FINANCE_API_PREFIX}/exchange-rates`,
  releases: `${FINANCE_API_PREFIX}/financial-releases`,
  exportRequests: `${FINANCE_API_PREFIX}/export-requests`,
} as const;

export const financeConsumerCompatibility = {
  sales:
    'Consumes sales.contract.activated/amended v1 by stable reference; no Sales table access.',
  reservations:
    'Consumes reservation.travel_document.issued v1 and publishes release changes; no Reservation table access.',
  purchases:
    'Consumes purchase.invoice_approved v1 including immutable price components; no Procurement table access.',
  customers:
    'Consumes public customer reference/display snapshots only; no customer PII or table access.',
  hr: 'Consumes only approved aggregate payroll input; no attendance, contract, or evaluation access.',
} as const;

export function normalizeFinanceListQuery(
  input: Partial<FinanceListQuery>,
): FinanceListQuery {
  const page = Number.isFinite(input.page)
    ? Math.max(1, Math.trunc(input.page!))
    : 1;
  const pageSize = Number.isFinite(input.pageSize)
    ? Math.min(100, Math.max(1, Math.trunc(input.pageSize!)))
    : 25;
  return {
    search: input.search?.trim().slice(0, 100) ?? '',
    branchReference: input.branchReference?.trim() || null,
    fiscalPeriodReference: input.fiscalPeriodReference?.trim() || null,
    currencyCode: input.currencyCode ?? 'ALL',
    status: input.status?.trim() || 'ALL',
    partyReference: input.partyReference?.trim() || null,
    sortBy: input.sortBy ?? 'updatedAt',
    sortDirection: input.sortDirection === 'asc' ? 'asc' : 'desc',
    page,
    pageSize,
  };
}
