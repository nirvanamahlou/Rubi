import type { Prisma } from '@nora/database';
export const floatingSalesServiceWhere = {
  OR: [
    {
      kind: 'FLIGHT',
      metadata: { path: ['contractFlightVersion'], equals: 1 },
    },
    {
      kind: 'FLIGHT',
      metadata: { path: ['purchaseSupplyType'], equals: 'FLOATING' },
    },
    {
      kind: 'HOTEL',
      metadata: { path: ['purchaseSupplyType'], equals: 'FLOATING' },
    },
  ],
} satisfies Prisma.SalesContractServiceWhereInput;
/** Matches isFloatingSalesContract using saved service metadata, including hotel-only contracts. */
export function salesSupplyWhere(
  type: 'FLOATING' | 'CHARTER',
): Prisma.SalesContractWhereInput {
  const floating: Prisma.SalesContractWhereInput = {
    services: {
      some: floatingSalesServiceWhere,
    },
  };
  return type === 'FLOATING' ? floating : { NOT: floating };
}
