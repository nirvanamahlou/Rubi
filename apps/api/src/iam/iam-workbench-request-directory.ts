import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  WorkbenchRequestOptionsV1,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { HrWorkbenchRequestUnits } from '../hr/hr-workbench-request-units';

/** Public IAM account directory; this never exposes grants, contact data or personnel records. */
@Injectable()
export class IamWorkbenchRequestDirectory {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(HrWorkbenchRequestUnits)
    private readonly units: HrWorkbenchRequestUnits,
  ) {}

  /** Minimal Call Center branch selector; no IAM administration authority is implied. */
  async callCenterBranches(actor: AuthenticatedActor) {
    if (!actor.permissions.includes('customer_affairs.call_center.read'))
      throw new ForbiddenException();
    return this.database.client.branch.findMany({
      where: { id: { in: [...actor.branchIds] }, isActive: true },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }
  async options(
    actor: AuthenticatedActor,
    branchId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<WorkbenchRequestOptionsV1> {
    if (!actor.branchIds.includes(branchId)) throw new ForbiddenException();
    const client = tx ?? this.database.client;
    const operator = await client.user.findFirst({
      where: {
        id: actor.userId,
        status: 'ACTIVE',
        b2bOrganizationUser: null,
        branches: { some: { branchId, branch: { isActive: true } } },
      },
      select: { id: true },
    });
    if (!operator) throw new ForbiddenException('شعبه در محدوده دسترسی نیست.');
    const units = await this.units.list(branchId, tx);
    if (!units.length) return { units: [] };
    const users = await client.user.findMany({
      where: {
        status: 'ACTIVE',
        b2bOrganizationUser: null,
        profile: { organizationUnitId: { in: units.map((unit) => unit.id) } },
        branches: { some: { branchId, branch: { isActive: true } } },
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        profile: { select: { organizationUnitId: true } },
      },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
    });
    return {
      units: units.map((unit) => ({
        ...unit,
        users: users
          .filter((user) => user.profile?.organizationUnitId === unit.id)
          .map(({ id, displayName, username }) => ({
            id,
            displayName,
            username,
          })),
      })),
    };
  }

  async resolve(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    branchId: string,
    unitId: string,
    recipientId: string,
  ) {
    // Share locks serialize against account edits, unit changes and branch removal.
    const ids = [...new Set([actor.userId, recipientId])].sort();
    await tx.$queryRaw`SELECT id FROM iam_users WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR SHARE`;
    await tx.$queryRaw`SELECT user_id FROM iam_user_profiles WHERE user_id = ${recipientId}::uuid FOR SHARE`;
    await tx.$queryRaw`SELECT "userId" FROM iam_user_branches WHERE "userId" IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) AND "branchId" = ${branchId}::uuid ORDER BY "userId" FOR SHARE`;
    await this.units.lock(tx, unitId);
    const options = await this.options(actor, branchId, tx);
    const unit = options.units.find((item) => item.id === unitId);
    const recipient = unit?.users.find((user) => user.id === recipientId);
    if (!unit || !recipient)
      throw new BadRequestException(
        'کاربر انتخاب‌شده عضو فعال واحد مقصد در این شعبه نیست؛ فهرست را دوباره بارگذاری کنید.',
      );
    return { unit, recipient };
  }
}
