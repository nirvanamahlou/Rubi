type SafeCustomer = {
  id: string;
  kind: string;
  isActive: boolean;
  isCustomer: boolean;
  isPassenger: boolean;
  version: number;
};

type SafeChild = Record<string, unknown>;

export function customerAuditSnapshot(
  customer: SafeCustomer,
  changedFields: readonly string[] = [],
) {
  return {
    customerId: customer.id,
    kind: customer.kind.toLowerCase(),
    status: customer.isActive ? 'active' : 'inactive',
    roles: [
      ...(customer.isCustomer ? ['customer'] : []),
      ...(customer.isPassenger ? ['passenger'] : []),
    ],
    version: customer.version,
    changedFields: [...changedFields].sort(),
  };
}

export function childAuditSnapshot(
  action: string,
  child: SafeChild | null,
): Record<string, unknown> {
  if (!child) return { outcome: 'not-created' };
  const customerId = child.customerId;
  switch (action) {
    case 'customers.contact.create':
      return {
        customerId,
        contactType: String(child.type).toLowerCase(),
        isPrimary: Boolean(child.isPrimary),
      };
    case 'customers.address.create':
      return {
        customerId,
        addressType: String(child.type).toLowerCase(),
        cityId: child.cityId ?? null,
        isPrimary: Boolean(child.isPrimary),
      };
    case 'customers.consent.create':
      return {
        customerId,
        purpose: String(child.purpose).toLowerCase(),
        channel: String(child.channel).toLowerCase(),
        status: String(child.status).toLowerCase(),
      };
    case 'customers.companion.create':
      return {
        customerId,
        relatedCustomerId: child.relatedCustomerId,
        relationshipType: String(child.relationshipType).toLowerCase(),
      };
    default:
      return { customerId, outcome: 'completed' };
  }
}

export function duplicateAuditSnapshot(input: {
  sourceCustomerId: string;
  candidateCustomerId: string;
  score?: number;
  reasons?: readonly string[];
  reviewStatus?: string;
  version?: number;
}) {
  return {
    sourceCustomerId: input.sourceCustomerId,
    candidateCustomerId: input.candidateCustomerId,
    ...(input.score === undefined ? {} : { score: input.score }),
    ...(input.reasons === undefined ? {} : { reasons: [...input.reasons] }),
    ...(input.reviewStatus === undefined
      ? {}
      : { reviewStatus: input.reviewStatus.toLowerCase() }),
    ...(input.version === undefined ? {} : { version: input.version }),
    mergeExecuted: false,
  };
}

export const controlledAuditReason = (code: string): string => code;
