import type { DatabaseClient, Prisma } from '@nora/database';
/** Bounded owner projection, never exposes contract parties or financial values. */
export async function customerDossierContractReferences(
  db: DatabaseClient,
  scope: Prisma.SalesContractWhereInput,
) {
  return db.salesContract.findMany({
    where: scope,
    select: { id: true },
    take: 1001,
    orderBy: { id: 'asc' },
  });
}
