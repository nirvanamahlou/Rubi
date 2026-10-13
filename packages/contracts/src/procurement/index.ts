/** Additive Procurement v1. Decimal amounts and quantities are canonical strings. */
export const PROCUREMENT_CONTRACT_VERSION = 1 as const;
export const PROCUREMENT_PERMISSION_CODES = [
  'procurement.read.own',
  'procurement.read.unit',
  'procurement.read.all',
  'procurement.request.create',
  'procurement.request.update',
  'procurement.request.submit',
  'procurement.request.cancel',
  'procurement.assign',
  'procurement.approve',
  'procurement.quote.manage',
  'procurement.quote.select',
  'procurement.order.manage',
  'procurement.order.issue',
  'procurement.order.amend',
  'procurement.order.cancel',
  'procurement.receipt.manage',
  'procurement.acceptance.manage',
  'procurement.discrepancy.manage',
  'procurement.return.manage',
  'procurement.invoice.manage',
  'procurement.invoice.submit_finance',
  'procurement.audit.read',
  'procurement.export',
  'procurement.settings.manage',
  'procurement.quote.single_source',
  'procurement.emergency',
] as const;
export type ProcurementPermission =
  (typeof PROCUREMENT_PERMISSION_CODES)[number];
export const PROCUREMENT_REQUEST_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'SOURCING',
  'CLOSED',
] as const;
export type ProcurementRequestStatus =
  (typeof PROCUREMENT_REQUEST_STATUSES)[number];
export type ProcurementReferenceV1 = {
  id: string;
  version: number;
  label: string;
};
export type ProcurementDocumentReferenceV1 = { id: string; versionId: string };
export type ProcurementDraftItemV1 = {
  id: string;
  kind: 'GOODS' | 'SERVICE';
  description: string;
  specification: string;
  quantity: string;
  unit: string;
  acceptanceCriteria: string;
  period: string;
};
export type ProcurementDraftV1 = {
  title: string;
  branchId: string;
  unitId: string | null;
  purchaseType: string;
  category: string;
  needReason: string;
  requiredAt: string | null;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  urgent: boolean;
  urgencyReason: string;
  estimatedAmount: string | null;
  currencyCode: string | null;
  unknownEstimateReason: string;
  deliveryLocation: string;
  notes: string;
  documents: ProcurementDocumentReferenceV1[];
  items: ProcurementDraftItemV1[];
  origin:
    | { kind: 'GENERAL' }
    | {
        kind: 'SPECIALIZED';
        module: 'RESERVATIONS';
        operationId: string;
        version: number;
      };
};
export type ProcurementRequestV1 = {
  id: string;
  number: string;
  version: number;
  status: ProcurementRequestStatus;
  requesterUserId: string;
  requesterEmployeeId?: string | null;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
  draft: ProcurementDraftV1;
};
export type ProcurementListV1<T> = {
  items: T[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};
export type ProcurementBootstrapV1 = {
  permissions: ProcurementPermission[];
  branches: { id: string; label: string }[];
  currencies: { id: string; code: string; name: string }[];
  policy: 'POLICY_NOT_CONFIGURED' | 'CONFIGURED';
  finance: 'NOT_CONNECTED' | 'CONNECTED';
  documents: 'AVAILABLE' | 'UNAVAILABLE';
  travel: 'NOT_CONNECTED' | 'CONNECTED';
};
/** Proposed owner-to-owner source; not an assertion that Finance accepts it. */
export type ProcurementFinanceSourceV1 = {
  contract: 'procurement.finance-source.v1';
  sourceId: string;
  sourceVersion: number;
  idempotencyKey: string;
  branchId: string;
  issuer: ProcurementReferenceV1;
  supplier: ProcurementReferenceV1;
  orderId: string;
  orderVersion: number;
  currencyCode: string;
  amount: string;
  dueAt: string | null;
  documents: ProcurementDocumentReferenceV1[];
  lines: {
    itemId: string;
    quantity: string;
    unitPrice: string;
    amount: string;
  }[];
};

export type ProcurementApprovalPolicyStepV1 = {
  userId: string;
  maximumAmount: string;
  permission: 'procurement.approve';
};

export type ProcurementApprovalPolicyV1 = {
  contract: 'settings.procurement-approval-policy.v1';
  id: string;
  version: number;
  branchId: string;
  unitId: string;
  category: string;
  currencyCode: string;
  maximumAmount: string;
  allowUnknownEstimate: boolean;
  emergencyAllowed: boolean;
  minimumQuotations: number;
  singleSourceAllowed: boolean;
  steps: ProcurementApprovalPolicyStepV1[];
  approvedAt: string;
  isActive: boolean;
};

export type ProcurementApprovalPolicyCreateV1 = Omit<
  ProcurementApprovalPolicyV1,
  'contract' | 'id' | 'version' | 'approvedAt' | 'isActive'
> & { version: 1 };

export type ProcurementFinanceResultV1 = {
  contract: 'finance.procurement-result.v1';
  sourceId: string;
  sourceVersion: number;
  financeReference: string;
  status: 'APPROVED' | 'CORRECTION_REQUIRED' | 'PARTIALLY_PAID' | 'PAID';
  financeVersion: number;
  cumulativePaid: string;
  remainingAmount: string;
  reason: string;
  occurredAt: string;
};

export type ProcurementFinanceCorrectionSourceV1 = {
  contract: 'procurement.finance-correction.v1';
  eventId: string;
  sourceVersion: 1;
  returnId: string;
  requestId: string;
  orderId: string;
  receiptItemId: string;
  branchId: string;
  quantity: string;
  reason: string;
  returnedAt: string;
};

export type ProcurementFinanceCorrectionResultV1 = {
  contract: 'finance.procurement-correction-result.v1';
  eventId: string;
  sourceVersion: number;
  financeReference: string;
  status: 'APPROVED' | 'CORRECTION_REQUIRED';
  reason: string;
  actorUserId: string;
  occurredAt: string;
};

export type ProcurementSupplierInboundEventV1 = {
  contract: 'procurement.supplier-inbound.v1';
  externalMessageId: string;
  eventType:
    | 'ORDER_ACKNOWLEDGED'
    | 'ORDER_REJECTED'
    | 'SHIPMENT_NOTICE'
    | 'INVOICE_AVAILABLE';
  orderReference: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};
