import type { IamPermissionCode } from '@nora/contracts';
import { CALL_CENTER_SALES_EXPERT, screenPermission } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { Prisma } from '@nora/database';
import { HrCallCenterRoster } from '../hr/hr-call-center-roster';

export const HR_OFFER_VERSION = 2147483647;
export const hrCallRoutingEnabled = () =>
  process.env.CALL_CENTER_HR_ROUTING_ENABLED === 'true';
/** IAM-owned current active-account/branch intersection of HR routing facts. */
export async function hrCallRoutes(
  db: DatabaseService,
  branchId: string,
  tx?: Prisma.TransactionClient,
) {
  if (!hrCallRoutingEnabled()) return [];
  const routes = await new HrCallCenterRoster(db).list(branchId, tx);
  const users = await (tx ?? db.client).user.findMany({
    where: {
      id: { in: [...new Set(routes.flatMap((r) => r.userIds))] },
      status: 'ACTIVE',
      b2bOrganizationUser: null,
      branches: { some: { branchId, branch: { isActive: true } } },
    },
    select: { id: true },
  });
  const eligible = new Set(users.map((u) => u.id));
  return routes
    .map((r) => ({ ...r, userIds: r.userIds.filter((id) => eligible.has(id)) }))
    .filter((r) => r.userIds.length);
}
/** Derived own-only capabilities; no persisted role, team or global grant. */
export async function hrCallPermissions(
  db: DatabaseService,
  userId: string,
  branches: readonly string[],
  permissions: readonly IamPermissionCode[],
) {
  if (!hrCallRoutingEnabled()) return [...permissions];
  let linked = false;
  for (const branch of branches)
    if (
      (await hrCallRoutes(db, branch)).some((r) => r.userIds.includes(userId))
    ) {
      linked = true;
      break;
    }
  return linked
    ? ([
        ...new Set([
          ...permissions,
          ...CALL_CENTER_SALES_EXPERT,
          screenPermission('customer-affairs.call-center'),
        ]),
      ] as IamPermissionCode[])
    : [...permissions];
}
