import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  hrBranchName,
  type AuthenticatedActor,
  type WorkbenchRequestOptionsV1,
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

  /** Current employee's authoritative branches, intersected with IAM access. */
  async callCenterEmployeeBranches(actor: AuthenticatedActor) {
    const allowed = await this.callCenterBranches(actor);
    return this.units.employeeBranches(
      actor.userId,
      allowed.map((branch) => branch.id),
    );
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
    const units = await this.units.list(branchId, tx, !callCenter);
    if (!units.length) return { units: [] };
    const members = callCenter ? [] : await this.units.members(branchId, tx);
    const users = await client.user.findMany({
      where: {
        status: 'ACTIVE',
        b2bOrganizationUser: null,
        OR: [
          {
            profile: {
              organizationUnitId: {
                in: [
                  ...new Set(
                    units.flatMap((unit) => [unit.id, ...(unit.aliases ?? [])]),
                  ),
                ],
              },
            },
          },
          ...(members.length
            ? [
                {
                  id: {
                    in: members.flatMap((member) =>
                      member.userId ? [member.userId] : [],
                    ),
                  },
                },
              ]
            : []),
        ],
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
        id: unit.id,
        name: unit.name,
        users: users
          .filter(
            (user) =>
              user.profile?.organizationUnitId === unit.id ||
              (!!user.profile?.organizationUnitId &&
                unit.aliases?.includes(user.profile.organizationUnitId)) ||
              members.some(
                (member) =>
                  member.userId === user.id &&
                  hrBranchName(member.unit) === hrBranchName(unit.name),
              ),
          )
          .map(({ id, displayName, username }) => ({
            id,
            displayName,
            username,
          })),
      })),
    };
  }

  async hrLeaveRecipient(actor: AuthenticatedActor, branchId: string) {
    const options = await this.options(actor, branchId);
    const matches = options.units.flatMap((unit) =>
      unit.users
        .filter(
          (user) =>
            user.username.toLowerCase() === 'nima' &&
            /منابع انسانی|سرمایه انسانی/.test(unit.name),
        )
        .map((user) => ({ unitId: unit.id, recipientId: user.id })),
    );
    if (matches.length !== 1)
      throw new BadRequestException(
        'گیرنده فعال منابع انسانی برای مرخصی در این شعبه به‌صورت یکتا تعریف نشده است.',
      );
    return matches[0]!;
  }
  async leaveRoute(actor: AuthenticatedActor, branchId: string) {
    const account = await this.database.client.user.findFirst({
      where: { id: actor.userId, status: 'ACTIVE' },
      select: { displayName: true },
    });
    const normalize = (name: string) =>
      name
        .normalize('NFKC')
        .replace(/[آأإ]/g, 'ا')
        .replace(/[يىئ]/g, 'ی')
        .replace(/ك/g, 'ک')
        .replace(/[\s‌]/g, '')
        .replace('مهسااعلایی', 'مهساعلایی');
    const name = normalize(account?.displayName ?? '');
    const routes: [string[], string][] = [
      [['الناز'], 'رویابهزادنیا'],
      [['بهناز', 'ناهید', 'اتنا', 'شیدا', 'شهرزاد'], 'مهساعلایی'],
      [['مهشید'], 'عسلشهبازی'],
      [['نیمانادری'], 'دانیالالطافی'],
    ];
    const manager = routes.find(([names]) =>
      names.some((n) => name.startsWith(n)),
    )?.[1];
    const options = await this.options(actor, branchId);
    const candidates = options.units.flatMap((unit) =>
      unit.users
        .filter(
          (user) =>
            user.id !== actor.userId &&
            (manager
              ? normalize(user.displayName).startsWith(manager)
              : /منابعانسانی|سرمایهانسانی/.test(normalize(unit.name)) &&
                normalize(user.displayName).startsWith('نیمانادری')),
        )
        .map((user) => ({ unitId: unit.id, recipientId: user.id })),
    );
    const unique = [
      ...new Map(
        candidates.map((route) => [route.recipientId, route]),
      ).values(),
    ];
    if (unique.length !== 1)
      throw new BadRequestException(
        'مدیر یا گیرنده منابع انسانی برای درخواست مرخصی به‌صورت یکتا تعریف نشده است.',
      );
    return unique[0]!;
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
    await this.units.lockEmployee(tx, recipientId, branchId);
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
