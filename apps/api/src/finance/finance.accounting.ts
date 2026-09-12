import type { FinanceRequestStatus } from '@rubi/contracts';

import { DecimalValue, FinanceDomainError } from './finance.money';
import { assertExpectedVersion, validateMakerChecker } from './finance.domain';

export type ChartAccountLevel = 'GROUP' | 'GENERAL' | 'SUBSIDIARY' | 'DETAIL';
export type AccountNature = 'DEBIT' | 'CREDIT';

export interface ChartAccountDefinition {
  id: string;
  code: string;
  title: string;
  level: ChartAccountLevel;
  parentReference: string | null;
  nature: AccountNature;
  permanent: boolean;
  control: boolean;
  postingAllowed: boolean;
  active: boolean;
  transactionCount: number;
  version: number;
}

const levelOrder: readonly ChartAccountLevel[] = [
  'GROUP',
  'GENERAL',
  'SUBSIDIARY',
  'DETAIL',
];

export function validateChartAccount(
  account: ChartAccountDefinition,
  parent: ChartAccountDefinition | null,
): void {
  if (!/^\d{1,20}$/.test(account.code)) {
    throw new FinanceDomainError(
      'INVALID_ACCOUNT_CODE',
      'Account code must contain only digits.',
    );
  }
  if (account.title.trim().length < 2) {
    throw new FinanceDomainError(
      'INVALID_ACCOUNT_TITLE',
      'Account title is required.',
    );
  }
  const levelIndex = levelOrder.indexOf(account.level);
  if (levelIndex === 0 && parent !== null) {
    throw new FinanceDomainError(
      'GROUP_CANNOT_HAVE_PARENT',
      'Account groups cannot have a parent.',
    );
  }
  if (levelIndex > 0) {
    if (!parent || levelOrder.indexOf(parent.level) !== levelIndex - 1) {
      throw new FinanceDomainError(
        'INVALID_ACCOUNT_PARENT',
        'Account parent must be the immediately higher level.',
      );
    }
    if (!account.code.startsWith(parent.code)) {
      throw new FinanceDomainError(
        'ACCOUNT_CODE_OUTSIDE_PARENT',
        'Child code must start with its parent code.',
      );
    }
  }
  if (account.postingAllowed !== (account.level === 'DETAIL')) {
    throw new FinanceDomainError(
      'INVALID_POSTING_LEVEL',
      'Only detail accounts can accept postings.',
    );
  }
}

export function assertAccountCanBeDeactivatedOrDeleted(
  account: ChartAccountDefinition,
  operation: 'DEACTIVATE' | 'DELETE',
): void {
  if (operation === 'DELETE' && account.transactionCount > 0) {
    throw new FinanceDomainError(
      'ACCOUNT_HAS_TURNOVER',
      'An account with turnover cannot be deleted.',
    );
  }
}

export type FiscalPeriodState = 'OPEN' | 'CLOSING' | 'CLOSED';

export function assertPeriodAllowsPosting(status: FiscalPeriodState): void {
  if (status !== 'OPEN') {
    throw new FinanceDomainError(
      'FISCAL_PERIOD_CLOSED',
      'Posting is allowed only in an open fiscal period.',
    );
  }
}

export interface PostingAuthorization {
  makerReference: string;
  checkerReference: string;
  checkerPermissions: readonly string[];
  expectedVersion: number;
  actualVersion: number;
  fiscalPeriodStatus: FiscalPeriodState;
}

export function authorizeJournalPosting(input: PostingAuthorization): void {
  assertExpectedVersion(input.actualVersion, input.expectedVersion);
  assertPeriodAllowsPosting(input.fiscalPeriodStatus);
  validateMakerChecker({
    makerReference: input.makerReference,
    checkerReference: input.checkerReference,
    checkerPermissions: input.checkerPermissions,
    requiredCheckerPermission: 'finance.journal.post',
  });
}

export interface AllocationInput {
  availableAmount: string;
  allocationAmounts: readonly string[];
}

export function assertAllocationsWithinAmount(input: AllocationInput): void {
  const available = DecimalValue.parse(input.availableAmount);
  if (available.isNegative || available.isZero) {
    throw new FinanceDomainError(
      'INVALID_AVAILABLE_AMOUNT',
      'Available amount must be positive.',
    );
  }
  const allocated = input.allocationAmounts.reduce(
    (sum, amount) => sum.add(DecimalValue.parse(amount)),
    DecimalValue.zero(),
  );
  if (allocated.isNegative || allocated.compare(available) > 0) {
    throw new FinanceDomainError(
      'ALLOCATION_EXCEEDS_AMOUNT',
      'Allocations cannot exceed the available amount.',
    );
  }
}

export interface ReceiptConfirmationInput {
  destinationAccountReference: string;
  actualAmount: string;
  currencyCode: string;
  actuallyReceivedAt: string;
  receiptReviewed: boolean;
  makerReference: string;
  checkerReference: string;
  checkerPermissions: readonly string[];
  expectedVersion: number;
  actualVersion: number;
}

export function validateReceiptConfirmation(
  input: ReceiptConfirmationInput,
): void {
  assertExpectedVersion(input.actualVersion, input.expectedVersion);
  if (!input.destinationAccountReference.trim()) {
    throw new FinanceDomainError(
      'DESTINATION_ACCOUNT_REQUIRED',
      'Receipt confirmation requires a destination account.',
    );
  }
  assertPositiveDecimal(input.actualAmount);
  assertUtc(input.actuallyReceivedAt);
  if (!input.currencyCode.trim()) {
    throw new FinanceDomainError('CURRENCY_REQUIRED', 'Currency is required.');
  }
  if (!input.receiptReviewed) {
    throw new FinanceDomainError(
      'RECEIPT_REVIEW_REQUIRED',
      'Receipt evidence must be reviewed.',
    );
  }
  validateMakerChecker({
    makerReference: input.makerReference,
    checkerReference: input.checkerReference,
    checkerPermissions: input.checkerPermissions,
    requiredCheckerPermission: 'finance.receipt.approve',
  });
}

export interface PaymentCompletionInput {
  sourceAccountReference: string;
  partyReference: string;
  actualAmount: string;
  currencyCode: string;
  paidAt: string;
  makerReference: string;
  checkerReference: string;
  checkerPermissions: readonly string[];
  expectedVersion: number;
  actualVersion: number;
}

export function validatePaymentCompletion(input: PaymentCompletionInput): void {
  assertExpectedVersion(input.actualVersion, input.expectedVersion);
  if (!input.sourceAccountReference.trim()) {
    throw new FinanceDomainError(
      'SOURCE_ACCOUNT_REQUIRED',
      'Payment requires a source account.',
    );
  }
  if (!input.partyReference.trim()) {
    throw new FinanceDomainError(
      'PARTY_REQUIRED',
      'Payment requires a valid party reference.',
    );
  }
  assertPositiveDecimal(input.actualAmount);
  assertUtc(input.paidAt);
  if (!input.currencyCode.trim()) {
    throw new FinanceDomainError('CURRENCY_REQUIRED', 'Currency is required.');
  }
  validateMakerChecker({
    makerReference: input.makerReference,
    checkerReference: input.checkerReference,
    checkerPermissions: input.checkerPermissions,
    requiredCheckerPermission: 'finance.payment.approve',
  });
}

export function validateRequestDecision(input: {
  status: Extract<FinanceRequestStatus, 'REJECTED' | 'CORRECTION_REQUIRED'>;
  reason: string;
}): void {
  if (input.reason.trim().length < 10) {
    throw new FinanceDomainError(
      'DECISION_REASON_REQUIRED',
      'Reject and correction decisions require a detailed reason.',
    );
  }
}

function assertPositiveDecimal(value: string): void {
  const amount = DecimalValue.parse(value);
  if (amount.isNegative || amount.isZero) {
    throw new FinanceDomainError('INVALID_AMOUNT', 'Amount must be positive.');
  }
}

function assertUtc(value: string): void {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new FinanceDomainError(
      'INVALID_UTC_TIME',
      'Time must be a UTC ISO-8601 timestamp.',
    );
  }
}
