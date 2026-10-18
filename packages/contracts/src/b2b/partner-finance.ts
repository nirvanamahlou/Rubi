import type { AuthenticatedActor } from '../iam';
import type { B2bFinanceExposureV1 } from './index';
export type PartnerRoleV1 = 'SUPPLIER' | 'BROKER';
export interface FinancePartnerExposurePortV1 {
  getPartnerExposure(
    query: {
      organizationId: string;
      branchId: string;
      role: PartnerRoleV1;
      currencyCode: string;
    },
    actor: AuthenticatedActor,
  ): Promise<B2bFinanceExposureV1>;
}
export interface PartnerPurchaseSourceV1 {
  id: string;
  source: 'RESERVATIONS' | 'PROCUREMENT';
  sourceVersion: number;
  title: string;
  reference: string;
  amount: string;
  currencyCode: string;
  createdAt: string;
  dueAt: string | null;
  current: boolean;
  /** Invoice source versions actually owned by this counterparty, not a name match. */
  ownedVersions?: number[];
}
export interface PartnerPaymentV1 {
  id: string;
  purchaseId: string;
  amount: string;
  currencyCode: string;
  occurredAt: string;
  reference: string | null;
  method: string | null;
}
export interface PartnerFinanceV1 {
  version: 1;
  organizationId: string;
  role: PartnerRoleV1;
  branchId: string;
  creditDirection: 'COUNTERPARTY_TO_US';
  observedAt: string;
  purchases: PartnerPurchaseSourceV1[];
  payments: PartnerPaymentV1[];
  requests?: {
    id: string;
    kind: string;
    title: string;
    reference: string;
    amount: string;
    currencyCode: string;
    status: string;
    dueAt: string;
    remainingAmount: string | null;
  }[];
  settlements?: {
    purchaseId: string;
    paid: string;
    remaining: string;
    status: 'OPEN' | 'PARTIALLY_PAID' | 'SETTLED' | 'CREDIT';
  }[];
  totals: {
    currencyCode: string;
    purchases: string;
    paid: string;
    balance: string;
  }[];
  /** Superseded obligations with payment evidence require reconciliation, not zero. */
  reconciliationRequired: string[];
}
