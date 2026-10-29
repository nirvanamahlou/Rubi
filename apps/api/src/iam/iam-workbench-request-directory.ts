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
import { IamCallCenterDirectory } from './iam-call-center-directory';

/** Public IAM account directory; this never exposes grants, contact data or personnel records. */
@Injectable()
export class IamWorkbenchRequestDirectory {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(HrWorkbenchRequestUnits)
    private readonly units: HrWorkbenchRequestUnits,
    @Inject(IamCallCenterDirectory)
    private readonly callAccounts: IamCallCenterDirectory = new IamCallCenterDirectory(
      database,
    ),
  ) {}

  /** Authoritative current team: own active HR unit, intersected with this branch. */
  async callCenterTeam(
    actor: AuthenticatedActor,
    branchId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.database.client;
    if (tx)
      await tx.$queryRaw`SELECT user_id FROM iam_user_profiles WHERE user_id=${actor.userId}::uuid FOR SHARE`;
    const account = await client.user.findFirst({
      where: {
        id: actor.userId,
        status: 'ACTIVE',
        b2bOrganizationUser: null,
        branches: { some: { branchId, branch: { isActive: true } } },
      },
      select: { profile: { select: { organizationUnitId: true } } },
    });
    const unitId = account?.profile?.organizationUnitId;
    if (!unitId || !actor.branchIds.includes(branchId)) return [];
    if (tx) {
      await this.units.lock(tx, unitId);
    }
    if (
      !(await this.units.list(branchId, tx)).some((unit) => unit.id === unitId)
    )
      return [];
    // Data responsibility follows current unit membership, not login eligibility:
    // managers must still be able to reassign an inactive colleague's contacts.
    // Recipient selection separately retains active-account/branch/native guards.
    const members = await client.user.findMany({
      where: {
        profile: { organizationUnitId: unitId },
        b2bOrganizationUser: null,
      },
      select: { id: true },
    });
    return members.map((member) => member.id);
  }

  async callCenterOperator(
    actor: AuthenticatedActor,
    branchId: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (!actor.branchIds.includes(branchId)) throw new ForbiddenException();
    if (await this.callAccounts.globalCallCenter(actor, tx)) return;
    if (tx) {
      await tx.$queryRaw`SELECT id FROM iam_users WHERE id=${actor.userId}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT "userId" FROM iam_user_branches WHERE "userId"=${actor.userId}::uuid AND "branchId"=${branchId}::uuid FOR SHARE`;
    }
    const operator = await (tx ?? this.database.client).user.findFirst({
      where: {
        id: actor.userId,
        status: 'ACTIVE',
        b2bOrganizationUser: null,
        branches: { some: { branchId, branch: { isActive: true } } },
      },
      select: { id: true },
    });
    if (!operator) throw new ForbiddenException();
  }

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
    callCenter = false,
  ): Promise<WorkbenchRequestOptionsV1> {
    if (!actor.branchIds.includes(branchId)) throw new ForbiddenException();
    const client = tx ?? this.database.client;
    const approvedGlobal =
      callCenter && (await this.callAccounts.globalCallCenter(actor, tx));
    const operator = await client.user.findFirst({
      where: {
        id: actor.userId,
        status: 'ACTIVE',
        b2bOrganizationUser: null,
        ...(!approvedGlobal
          ? { branches: { some: { branchId, branch: { isActive: true } } } }
          : {}),
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
