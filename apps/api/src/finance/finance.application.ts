import type {
  ApprovalRequestContract,
  FinanceActorContract,
  FinanceInboundEventV1,
  FinanceListQuery,
  FinanceOutboundEventV1,
  FinancePage,
  FinancePublicReference,
  FinancialReleaseEvaluationContract,
  JournalDraftContract,
  MoneyContract,
} from '@rubi/contracts';

import type {
  Account,
  Budget,
  ClosingState,
  FiscalPeriod,
  Invoice,
  JournalEntry,
  Payable,
  Payment,
  Receivable,
  Receipt,
  Settlement,
  Transfer,
} from './finance.domain';

export interface FinanceCommandContext {
  actor: FinanceActorContract;
  idempotencyKey: string;
  requestFingerprint: string;
  expectedVersion: number;
  occurredAt: string;
  traceId: string;
}

export interface FinanceQueryPort {
  dashboard(
    query: FinanceListQuery,
    actor: FinanceActorContract,
  ): Promise<{
    bankBalance: readonly MoneyContract[];
    cashBalance: readonly MoneyContract[];
    receivable: readonly MoneyContract[];
    payable: readonly MoneyContract[];
    dueCheckCount: number;
    contractMargin: readonly MoneyContract[];
  }>;
  listAccounts(
    query: FinanceListQuery,
    actor: FinanceActorContract,
  ): Promise<FinancePage<Account>>;
  listJournals(
    query: FinanceListQuery,
    actor: FinanceActorContract,
  ): Promise<FinancePage<JournalEntry>>;
  listReceivables(
    query: FinanceListQuery,
    actor: FinanceActorContract,
  ): Promise<FinancePage<Receivable>>;
  listPayables(
    query: FinanceListQuery,
    actor: FinanceActorContract,
  ): Promise<FinancePage<Payable>>;
  listChecks(
    query: FinanceListQuery,
    actor: FinanceActorContract,
  ): Promise<FinancePage<CheckProjection>>;
  financialTimeline(
    caseReference: FinancePublicReference,
    actor: FinanceActorContract,
  ): Promise<readonly FinanceTimelineItem[]>;
}

export interface FinanceCommandPort {
  createJournal(
    draft: JournalDraftContract,
    context: FinanceCommandContext,
  ): Promise<JournalEntry>;
  requestApproval(
    request: ApprovalRequestContract,
    context: FinanceCommandContext,
  ): Promise<{ approvalReference: string; status: 'PENDING' }>;
  recordReceipt(
    draft: ReceiptDraft,
    context: FinanceCommandContext,
  ): Promise<Receipt>;
  recordPayment(
    draft: PaymentDraft,
    context: FinanceCommandContext,
  ): Promise<Payment>;
  recordTransfer(
    draft: TransferDraft,
    context: FinanceCommandContext,
  ): Promise<Transfer>;
  registerCheck(
    draft: CheckDraft,
    context: FinanceCommandContext,
  ): Promise<CheckProjection>;
  createInvoice(
    draft: InvoiceDraft,
    context: FinanceCommandContext,
  ): Promise<Invoice>;
  createSettlement(
    draft: SettlementDraft,
    context: FinanceCommandContext,
  ): Promise<Settlement>;
  evaluateFinancialRelease(
    request: FinancialReleaseEvaluationContract,
    context: FinanceCommandContext,
  ): Promise<{
    status: 'BLOCKED' | 'CONDITIONAL' | 'APPROVED';
    auditReference: string;
  }>;
}

export interface FinanceConfigurationPort {
  resolveBaseCurrency(legalEntityReference: string): Promise<string>;
  resolveCurrencyPolicy(currencyCode: string): Promise<{
    accountingScale: number;
    roundingMode: 'HALF_UP' | 'HALF_EVEN' | 'DOWN';
  }>;
  resolveApprovalRules(
    request: ApprovalRequestContract,
  ): Promise<readonly string[]>;
  resolveTaxRule(
    ruleReference: string,
    validAt: string,
  ): Promise<TaxRuleSnapshot | null>;
  resolveRecognitionRule(
    ruleReference: string,
    validAt: string,
  ): Promise<RecognitionRuleSnapshot | null>;
}

export interface FinanceIntegrationPort {
  consume(event: FinanceInboundEventV1): Promise<void>;
  publish(event: FinanceOutboundEventV1): Promise<void>;
}

export interface FinanceIdempotencyPort {
  begin(input: {
    scope: string;
    key: string;
    requestFingerprint: string;
    occurredAt: string;
  }): Promise<'STARTED' | 'REPLAY'>;
  complete(input: {
    scope: string;
    key: string;
    resultReference: string;
  }): Promise<void>;
}

export interface FinanceAuditPort {
  append(event: {
    actorReference: string;
    action: string;
    entityReference: string;
    before: Readonly<Record<string, unknown>> | null;
    after: Readonly<Record<string, unknown>> | null;
    reason: string;
    occurredAt: string;
    traceId: string;
  }): Promise<{ auditReference: string }>;
}

export interface FinanceClockPort {
  nowUtc(): string;
}

export interface ReceiptDraft {
  financialAccountReference: string;
  partyReference: FinancePublicReference;
  contractReference: FinancePublicReference | null;
  amount: MoneyContract;
  method:
    'CASH' | 'CARD' | 'TRANSFER' | 'GATEWAY' | 'CHECK' | 'CREDIT' | 'MIXED';
  allocationReferences: readonly string[];
}

export interface PaymentDraft extends ReceiptDraft {
  payableReferences: readonly string[];
}

export interface TransferDraft {
  fromFinancialAccountReference: string;
  toFinancialAccountReference: string;
  amount: MoneyContract;
  fee: MoneyContract;
}

export interface CheckDraft {
  direction: 'RECEIVABLE' | 'PAYABLE';
  sayadReference: string | null;
  bankReference: FinancePublicReference;
  branchSnapshot: string;
  amount: MoneyContract;
  issueAt: string;
  dueAt: string;
  partyReference: FinancePublicReference;
  financialAccountReference: string;
  invoiceReference: string | null;
  contractReference: FinancePublicReference | null;
  documentReference: FinancePublicReference | null;
}

export interface CheckProjection extends CheckDraft {
  id: string;
  status:
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
  version: number;
}

export interface InvoiceDraft {
  kind: 'SALES' | 'PURCHASE';
  partyReference: FinancePublicReference;
  contractReference: FinancePublicReference | null;
  lines: readonly {
    serviceReference: FinancePublicReference | null;
    descriptionSnapshot: string;
    quantity: string;
    unitAmount: MoneyContract;
    discountAmount: MoneyContract;
    taxRuleReference: string | null;
  }[];
}

export interface SettlementDraft {
  partyReference: FinancePublicReference;
  allocationReferences: readonly string[];
  amount: MoneyContract;
}

export interface FinanceTimelineItem {
  id: string;
  type:
    | 'INVOICE'
    | 'RECEIPT'
    | 'PAYMENT'
    | 'CHECK'
    | 'APPROVAL'
    | 'RELEASE'
    | 'AUDIT';
  title: string;
  occurredAt: string;
  actorReference: string;
  reference: string;
}

export interface TaxRuleSnapshot {
  ruleReference: string;
  version: number;
  validAt: string;
  calculationBasis: string;
  rate: string;
}

export interface RecognitionRuleSnapshot {
  ruleReference: string;
  version: number;
  validAt: string;
  trigger:
    | 'CONTRACT_ACTIVATION'
    | 'SERVICE_DELIVERY'
    | 'TRAVEL_COMPLETION'
    | 'MANUAL_APPROVAL';
}

export interface FinancePlanningPort {
  listFiscalPeriods(
    actor: FinanceActorContract,
  ): Promise<readonly FiscalPeriod[]>;
  listBudgets(
    query: FinanceListQuery,
    actor: FinanceActorContract,
  ): Promise<FinancePage<Budget>>;
  getClosingState(
    fiscalPeriodReference: string,
    actor: FinanceActorContract,
  ): Promise<ClosingState | null>;
}
