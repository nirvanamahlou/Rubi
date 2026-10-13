import type { Prisma } from '@nora/database';

/** B2B-owned public projection for IAM snapshots; no contact or commercial data. */
export function readB2bAccessSnapshot(
  db: Pick<Prisma.TransactionClient, 'b2bOrganizationUser'>,
  userId: string,
) {
  return db.b2bOrganizationUser.findUnique({
    where: { userId },
    select: {
      organizationId: true,
      branchId: true,
      isActive: true,
      sections: true,
      version: true,
    },
  });
}
