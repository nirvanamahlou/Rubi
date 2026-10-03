import type { DatabaseClient } from './client';
import { PERMISSION_SEED_DATA } from './permission-seed-data';

/** Owner-approved local repair, not a login-time grant or a general seed. */
export const TOUR_PRICING_REPAIR_GRANTS = [
  'package_pricing.read',
  'package_pricing.cost.read',
  'package_pricing.margin.read',
  'package_pricing.period.manage',
] as const;

export interface PricingAccessRepairInput {
  userId: string;
  roleCode: string;
  reason: string;
  apply?: boolean;
}

export async function repairPackagePricingAccess(
  database: DatabaseClient,
  input: PricingAccessRepairInput,
) {
  const reason = input.reason.trim();
  if (
    !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(input.userId) ||
    !/^[a-z][a-z0-9_-]{2,79}$/.test(input.roleCode) ||
    reason.length < 5 ||
    reason.length > 120
  ) {
    throw new Error('Invalid repair target or reason.');
  }
  const catalog = PERMISSION_SEED_DATA.filter(([code]) =>
    code.startsWith('package_pricing.'),
  );
  return database.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: input.userId },
        select: { status: true },
      });
      const role = await tx.role.findUnique({
        where: { code: input.roleCode },
        select: {
          id: true,
          isActive: true,
          isSystem: true,
          users: { select: { userId: true } },
          permissions: { select: { permission: { select: { code: true } } } },
        },
      });
      // Never widen a shared/system role or silently assign another role/user.
      if (
        user?.status !== 'ACTIVE' ||
        !role?.isActive ||
        role.isSystem ||
        role.users.length !== 1 ||
        role.users[0]?.userId !== input.userId
      ) {
        throw new Error(
          'An active, exclusively assigned custom role is required.',
        );
      }
      const existing = await tx.permission.findMany({
        where: { code: { in: catalog.map(([code]) => code) } },
        select: { code: true },
      });
      const existingCodes = new Set(existing.map(({ code }) => code));
      const assigned = new Set(
        role.permissions.map(({ permission }) => permission.code),
      );
      const missingCatalog = catalog.filter(
        ([code]) => !existingCodes.has(code),
      );
      const missingGrants = TOUR_PRICING_REPAIR_GRANTS.filter(
        (code) => !assigned.has(code),
      );
      const result = {
        applied: Boolean(input.apply),
        catalogAdded: missingCatalog.map(([code]) => code),
        grantsAdded: [...missingGrants],
      };
      if (!input.apply || (!missingCatalog.length && !missingGrants.length))
        return result;

      for (const [code, module, name] of missingCatalog) {
        await tx.permission.upsert({
          where: { code },
          create: { code, module, name },
          update: {},
        });
      }
      for (const code of missingGrants) {
        const permission = await tx.permission.findUniqueOrThrow({
          where: { code },
          select: { id: true },
        });
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          create: { roleId: role.id, permissionId: permission.id },
          update: {},
        });
      }
      await tx.auditEvent.create({
        data: {
          actorUserId: input.userId,
          action: 'iam.package_pricing.access_repaired',
          entityType: 'Role',
          entityId: role.id,
          outcome: 'SUCCESS',
          metadata: {
            reason,
            source: 'owner-approved-local-repair',
            catalogAdded: result.catalogAdded,
            grantsAdded: result.grantsAdded,
          },
        },
      });
      return result;
    },
    { isolationLevel: 'Serializable' },
  );
}
