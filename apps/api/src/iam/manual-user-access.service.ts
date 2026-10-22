import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IAM_PERMISSION_CODES,
  CALL_CENTER_SCOPED_ACCESS,
  mustScopeCallCenter,
  completeManualAccessPrerequisites,
  MANUAL_ACCESS_ROLE_PREFIX,
  MANUAL_ACCESS_VERSION,
  USER_ACCESS_SCREENS,
  USER_ACCESS_DENY_CONTROLS,
  canUseMasterDataResource,
  hasAccessControl,
  canViewScreen,
  type AuthenticatedActor,
  type ManualAccessSelection,
} from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { authenticatedPermissionCodes } from './authenticated-permissions';
import {
  manualAccessRevision,
  manualAccessSelection,
  manualSnapshotCodes,
  previewManualConversion,
  canDelegateCallCenterScopeFlag,
} from './manual-access-policy';
import { readB2bAccessSnapshot } from '../b2b/b2b-access-snapshot.public';
import type { ManualUserAccessDto } from './dto/manual-user-access.dto';

export const manualUserInclude = {
  roles: {
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  },
  branches: true,
} as const;

export async function persistManualSnapshot(
  tx: Pick<
    Prisma.TransactionClient,
    'role' | 'permission' | 'rolePermission' | 'userRole'
  >,
  userId: string,
  title: string,
  selection: ManualAccessSelection,
) {
  const code = MANUAL_ACCESS_ROLE_PREFIX + userId;
  const existing = await tx.role.findUnique({
    where: { code },
    include: { users: true },
  });
  if (
    existing &&
    (existing.isSystem || existing.users.some((u) => u.userId !== userId))
  )
    throw new ConflictException('نقش دسترسی اختصاصی به کاربر دیگری متصل است.');
  const role = await tx.role.upsert({
    where: { code },
    create: { code, name: title || 'دسترسی دستی', isActive: true },
    update: { name: title || 'دسترسی دستی', isActive: true },
  });
  const grants = manualSnapshotCodes(selection);
  await tx.permission.createMany({
    data: grants.map((code) => ({
      code,
      name: code,
      module: code.startsWith('ui.') ? 'iam-ui' : code.split('.')[0]!,
    })),
    skipDuplicates: true,
  });
  const ids = (
    await tx.permission.findMany({
      where: { code: { in: grants } },
      select: { id: true },
    })
  ).map((p) => p.id);
  await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
  await tx.rolePermission.createMany({
    data: ids.map((permissionId) => ({ roleId: role.id, permissionId })),
  });
  await tx.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    update: {},
    create: { userId, roleId: role.id },
  });
}

@Injectable()
export class ManualUserAccessService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async delete(userId: string, revision: string, actor: AuthenticatedActor) {
    if (typeof revision !== 'string' || !/^[a-f0-9]{64}$/.test(revision))
      throw new BadRequestException('نسخهٔ معتبر دسترسی برای حذف لازم است.');
    if (userId === actor.userId)
      throw new ConflictException('حذف حساب جاری مجاز نیست.');
    return this.database.client.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('iam-administrator-membership'))::text`;
        // FK insertions and concurrent account mutations cannot race the dependency check.
        await tx.$queryRaw`SELECT id FROM iam_users WHERE id IN (${userId}::uuid, ${actor.userId}::uuid) ORDER BY id FOR UPDATE`;
        const operator = await tx.user.findUnique({
          where: { id: actor.userId },
          include: manualUserInclude,
        });
        // Permanent deletion is intentionally restricted to a live canonical administrator.
        if (
          operator?.status !== 'ACTIVE' ||
          !authenticatedPermissionCodes(operator.roles).includes(
            'iam.users.manage',
          ) ||
          !operator.roles.some(
            ({ role }) => role.isActive && role.code === 'administrator',
          )
        )
          throw new ForbiddenException(
            'حذف کاربر فقط برای مدیر سامانه مجاز است.',
          );
        const user = await tx.user.findUnique({
          where: { id: userId },
          include: {
            ...manualUserInclude,
            _count: true,
            hrEmployee: { select: { id: true } },
            b2bOrganizationUser: true,
          },
        });
        if (!user) throw new NotFoundException('کاربر پیدا نشد.');
        const scoped = {
          ...user,
          b2bOrganizationUser: await readB2bAccessSnapshot(tx, userId),
        };
        if (manualAccessRevision(scoped) !== revision)
          throw new ConflictException(
            'دسترسی کاربر تغییر کرده است؛ دوباره بارگذاری کنید.',
          );
        const accounts = await tx.user.findMany({
          where: { status: 'ACTIVE' },
          include: manualUserInclude,
        });
        const isManager = (entry: (typeof accounts)[number]) => {
          const codes = authenticatedPermissionCodes(entry.roles);
          return (
            codes.includes('iam.users.read') &&
            codes.includes('iam.users.manage') &&
            canViewScreen(codes, 'system.users')
          );
        };
        if (
          user.status === 'ACTIVE' &&
          ((isManager(user) &&
            !accounts.some(
              (entry) => entry.id !== userId && isManager(entry),
            )) ||
            (user.roles.some(
              ({ role }) => role.isActive && role.code === 'administrator',
            ) &&
              !accounts.some(
                (entry) =>
                  entry.id !== userId &&
                  entry.roles.some(
                    ({ role }) =>
                      role.isActive && role.code === 'administrator',
                  ),
              )))
        )
          throw new ConflictException('حذف آخرین مدیر فعال مجاز نیست.');
        const owned = new Set(['roles', 'branches', 'sessions']);
        if (
          user.hrEmployee ||
          user.b2bOrganizationUser ||
          Object.entries(user._count).some(
            ([key, count]) => !owned.has(key) && count > 0,
          )
        )
          throw new ConflictException(
            'این کاربر سابقه یا اطلاعات وابسته دارد؛ برای حفظ سوابق، از غیرفعال‌سازی استفاده کنید.',
          );
        await tx.auditEvent.create({
          data: {
            actorUserId: actor.userId,
            action: 'iam.user.delete',
            entityType: 'User',
            entityId: userId,
            outcome: 'SUCCESS',
          },
        });
        await tx.user.delete({ where: { id: userId } });
        return { success: true };
      },
      { timeout: 30_000 },
    );
  }

  async read(userId: string) {
    const user = await this.database.client.user.findUnique({
      where: { id: userId },
      include: manualUserInclude,
    });
    if (!user) throw new NotFoundException('کاربر پیدا نشد.');
    return {
      ...previewManualConversion({
        ...user,
        b2bOrganizationUser: await readB2bAccessSnapshot(
          this.database.client,
          user.id,
        ),
      }),
      title:
        user.roles.find(
          ({ role }) =>
            role.isActive && role.code.startsWith(MANUAL_ACCESS_ROLE_PREFIX),
        )?.role.name ??
        user.roles.find(
          ({ role }) =>
            role.isActive && !role.code.startsWith('personal-access-'),
        )?.role.name ??
        'دسترسی دستی',
    };
  }

  async save(
    userId: string,
    dto: ManualUserAccessDto,
    actor: AuthenticatedActor,
  ) {
    return this.database.client.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('iam-administrator-membership'))::text`;
        const [user, operator] = await Promise.all([
          tx.user.findUnique({
            where: { id: userId },
            include: manualUserInclude,
          }),
          tx.user.findUnique({
            where: { id: actor.userId },
            include: manualUserInclude,
          }),
        ]);
        if (!user) throw new NotFoundException('کاربر پیدا نشد.');
        if (!operator || operator.status !== 'ACTIVE')
          throw new ForbiddenException();
        const authority = authenticatedPermissionCodes(operator.roles);
        if (!authority.includes('iam.users.manage'))
          throw new ForbiddenException();
        const scopedUser = {
          ...user,
          b2bOrganizationUser: await readB2bAccessSnapshot(tx, user.id),
        };
        if (manualAccessRevision(scopedUser) !== dto.revision)
          throw new ConflictException(
            'دسترسی کاربر تغییر کرده است؛ دوباره بارگذاری کنید.',
          );
        const before = manualAccessSelection(scopedUser);
        const requested: ManualAccessSelection =
          completeManualAccessPrerequisites(
            {
              permissionCodes: [...dto.permissionCodes].sort(),
              screenIds: [...dto.screenIds].sort(),
              allowedControlIds: [...dto.allowedControlIds].sort(),
            },
            before,
          );
        // Opt-in is sticky: removing scope ticks cannot fall back to legacy branch-wide read.
        // Unrelated edits to pre-existing accounts do not opt them in.
        if (mustScopeCallCenter(before, requested)) {
          if (!requested.permissionCodes.includes(CALL_CENTER_SCOPED_ACCESS))
            requested.permissionCodes.push(CALL_CENTER_SCOPED_ACCESS);
        }
        const storedPermissions = await tx.permission.findMany({
          where: { NOT: { code: { startsWith: 'ui.' } } },
          select: { code: true },
        });
        const knownNative = new Set<string>([
          ...IAM_PERMISSION_CODES,
          ...storedPermissions.map((p) => p.code),
        ]);
        const knownScreens = new Set(USER_ACCESS_SCREENS.map((s) => s.id));
        const knownControls = new Set(
          USER_ACCESS_DENY_CONTROLS.map((c) => c.id),
        );
        if (
          requested.permissionCodes.some(
            (c) =>
              c.startsWith('ui.') ||
              (!knownNative.has(c) && !before.permissionCodes.includes(c)),
          ) ||
          requested.screenIds.some((id) => !knownScreens.has(id)) ||
          requested.allowedControlIds.some((id) => !knownControls.has(id))
        )
          throw new BadRequestException('مجوز یا کنترل انتخاب‌شده معتبر نیست.');
        const administrator = operator.roles.some(
          ({ role }) => role.isActive && role.code === 'administrator',
        );
        if (!administrator) {
          const delegable = manualAccessSelection({
            ...operator,
            b2bOrganizationUser: await readB2bAccessSnapshot(tx, operator.id),
          });
          // This sticky, restrictive policy flag adds no operation/data authority.
          if (canDelegateCallCenterScopeFlag(authority, before, requested))
            delegable.permissionCodes.push(CALL_CENTER_SCOPED_ACCESS);
          delegable.allowedControlIds = delegable.allowedControlIds.filter(
            (id) => {
              if (!hasAccessControl(authority, id)) return false;
              if (id.startsWith('master-data.resource.'))
                return canUseMasterDataResource(
                  authority,
                  id.slice('master-data.resource.'.length),
                );
              if (id.startsWith('field.master-data.')) {
                const suffix = id.slice('field.master-data.'.length);
                return (
                  canUseMasterDataResource(
                    authority,
                    suffix.slice(0, suffix.lastIndexOf('.')),
                  ) &&
                  authority.some((p) =>
                    ['master_data.create', 'master_data.update'].includes(p),
                  )
                );
              }
              if (id.startsWith('field.customers.'))
                return authority.some((p) =>
                  ['customers.create', 'customers.update'].includes(p),
                );
              if (id.startsWith('field.system-settings.'))
                return authority.includes('system.settings.manage');
              return canViewScreen(authority, id);
            },
          );
          for (const key of [
            'permissionCodes',
            'screenIds',
            'allowedControlIds',
          ] as const) {
            const changes = new Set([
              ...requested[key].filter((id) => !before[key].includes(id)),
              ...before[key].filter((id) => !requested[key].includes(id)),
            ]);
            if ([...changes].some((id) => !delegable[key].includes(id)))
              throw new ForbiddenException(
                'تغییر دسترسی خارج از اختیار شما است.',
              );
          }
        }
        // Preserve unknown grants; they cannot be silently dropped by an older editor.
        for (const code of before.permissionCodes)
          if (
            !knownNative.has(code) &&
            !requested.permissionCodes.includes(code)
          )
            requested.permissionCodes.push(code);
        if (
          before.permissionCodes.includes('iam.users.manage') &&
          before.permissionCodes.includes('iam.users.read') &&
          before.screenIds.includes('system.users') &&
          (!requested.permissionCodes.includes('iam.users.manage') ||
            !requested.permissionCodes.includes('iam.users.read') ||
            !requested.screenIds.includes('system.users'))
        ) {
          const otherManagers = await tx.user.findMany({
            where: { status: 'ACTIVE', id: { not: userId } },
            include: manualUserInclude,
          });
          if (
            !otherManagers.some((u) => {
              const codes = authenticatedPermissionCodes(u.roles);
              return (
                codes.includes('iam.users.manage') &&
                codes.includes('iam.users.read') &&
                canViewScreen(codes, 'system.users')
              );
            })
          )
            throw new ConflictException(
              'دسترسی آخرین مدیر کاربران قابل حذف نیست.',
            );
        }
        await persistManualSnapshot(tx, userId, dto.title, requested);
        await tx.auditEvent.create({
          data: {
            actorUserId: actor.userId,
            action: 'iam.user.manual_access.update',
            entityType: 'User',
            entityId: userId,
            outcome: 'SUCCESS',
            metadata: {
              version: MANUAL_ACCESS_VERSION,
              before: { ...before },
              after: { ...requested },
              previousRevision: dto.revision,
            },
          },
        });
        return { id: userId, version: MANUAL_ACCESS_VERSION };
      },
      { isolationLevel: 'Serializable', timeout: 60000 },
    );
  }
}
