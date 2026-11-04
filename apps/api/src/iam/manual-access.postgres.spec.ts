import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createDatabaseClient } from '@nora/database';
import {
  MANUAL_ACCESS_ROLE_PREFIX,
  CALL_CENTER_SCOPED_ACCESS,
  MANUAL_NEW_PERMISSIONS,
  canViewRoute,
  visibleIntegrationSections,
  type AuthenticatedActor,
} from '@nora/contracts';
import {
  planManualAccessMigration,
  applyManualAccessMigration,
} from './manual-access-migration';
import {
  ManualUserAccessService,
  manualUserInclude,
} from './manual-user-access.service';
import { authenticatedPermissionCodes } from './authenticated-permissions';
import { IamService } from './iam.service';
import type { DatabaseService } from '../database/database.service';

const url = process.env.IAM_V3_TEST_DATABASE_URL;
describe.skipIf(!url)(
  'manual access on an isolated PostgreSQL database',
  () => {
    if (
      url &&
      !/^rubi_iam_v3_test_[a-z0-9_]+$/.test(new URL(url).pathname.slice(1))
    )
      throw new Error('Isolated IAM test database required');
    const db = url ? createDatabaseClient(url) : null!;
    let adminId = '',
      targetId = '',
      sharedId = '';
    const service = new ManualUserAccessService({
      client: db,
    } as DatabaseService);
    const actor = (): AuthenticatedActor => ({
      userId: adminId,
      sessionId: 'test',
      branchIds: [],
      permissions: ['iam.users.manage'],
    });
    beforeAll(async () => {
      if (await db.user.count())
        throw new Error('Fresh empty IAM test database required');
      const entries = await Promise.all(
        [
          'iam.users.manage',
          'iam.users.read',
          'customers.read',
          'customers.update',
          'ui.deny.field.customers.firstName',
          'reporting.read',
        ].map((code) =>
          db.permission.create({ data: { code, name: code, module: 'test' } }),
        ),
      );
      const adminRole = await db.role.create({
        data: {
          code: 'administrator',
          name: 'test admin',
          isSystem: true,
          permissions: {
            create: entries.slice(0, 4).map((p) => ({ permissionId: p.id })),
          },
        },
      });
      const sharedRole = await db.role.create({
        data: {
          code: 'shared-test-staff',
          name: 'test staff',
          permissions: {
            create: entries.slice(2).map((p) => ({ permissionId: p.id })),
          },
        },
      });
      sharedId = sharedRole.id;
      adminId = (
        await db.user.create({
          data: {
            username: 'iam-v3-test-admin',
            displayName: 'Synthetic administrator',
            passwordHash: 'test-only-no-login',
            roles: { create: { roleId: adminRole.id } },
          },
        })
      ).id;
      targetId = (
        await db.user.create({
          data: {
            username: 'iam-v3-test-staff',
            displayName: 'Synthetic staff',
            passwordHash: 'test-only-no-login',
            roles: { create: { roleId: sharedId } },
          },
        })
      ).id;
    }, 60000);
    afterAll(async () => {
      await db?.$disconnect();
    });

    it('rejects stale previews without changing any user', async () => {
      const plan = await planManualAccessMigration(db);
      await db.user.update({
        where: { id: targetId },
        data: { status: 'INACTIVE' },
      });
      await expect(
        applyManualAccessMigration(db, plan.fingerprint),
      ).rejects.toThrow('STALE');
      expect(
        await db.role.count({
          where: { code: { startsWith: MANUAL_ACCESS_ROLE_PREFIX } },
        }),
      ).toBe(0);
      await db.user.update({
        where: { id: targetId },
        data: { status: 'ACTIVE' },
      });
    });

    it('maps existing grants, keeps shared memberships and leaves all genuinely new permissions off', async () => {
      const before = await planManualAccessMigration(db);
      const result = await applyManualAccessMigration(db, before.fingerprint);
      expect(result).toMatchObject({ converted: 2, equivalent: true });
      const after = await planManualAccessMigration(db);
      expect(after.rows.map((r) => r.selection)).toEqual(
        before.rows.map((r) => r.selection),
      );
      for (const row of after.rows)
        expect(
          row.selection.permissionCodes.some((c) =>
            MANUAL_NEW_PERMISSIONS.some(([p]) => p === c),
          ),
        ).toBe(false);
      expect(
        await db.userRole.count({
          where: { userId: targetId, roleId: sharedId },
        }),
      ).toBe(1);
      expect(
        await db.auditEvent.count({
          where: { action: 'iam.user.manual_access.migrate' },
        }),
      ).toBe(2);
      expect(
        await applyManualAccessMigration(db, after.fingerprint),
      ).toMatchObject({ converted: 0, unchanged: 2 });
    }, 90000);

    it('revokes native API authority on the next authentication projection and restores it only when checked', async () => {
      const before = await service.read(targetId);
      await service.save(
        targetId,
        {
          ...before.selection,
          revision: before.revision,
          title: 'staff',
          permissionCodes: before.selection.permissionCodes.filter(
            (c) => !['customers.update', 'reporting.read'].includes(c),
          ),
        },
        actor(),
      );
      const stored = await db.user.findUniqueOrThrow({
        where: { id: targetId },
        include: manualUserInclude,
      });
      const effective = authenticatedPermissionCodes(stored.roles);
      expect(effective).not.toContain('customers.update');
      expect(before.selection.permissionCodes).toContain('reporting.read');
      expect(effective).not.toContain('reporting.read');
      expect(() =>
        IamService.prototype.assertPermissions.call(
          {} as IamService,
          { ...actor(), permissions: effective },
          ['customers.update'],
        ),
      ).toThrow();
      expect(
        stored.roles
          .find((r) => r.role.id === sharedId)!
          .role.permissions.some(
            (p) => p.permission.code === 'customers.update',
          ),
      ).toBe(true);
      await expect(
        service.save(
          targetId,
          { ...before.selection, revision: before.revision, title: 'stale' },
          actor(),
        ),
      ).rejects.toThrow();
      const next = await service.read(targetId);
      await service.save(
        targetId,
        {
          ...next.selection,
          revision: next.revision,
          title: 'staff',
          permissionCodes: [
            ...next.selection.permissionCodes,
            'customers.update',
          ],
        },
        actor(),
      );
      const restored = await db.user.findUniqueOrThrow({
        where: { id: targetId },
        include: manualUserInclude,
      });
      expect(authenticatedPermissionCodes(restored.roles)).toContain(
        'customers.update',
      );
    }, 90000);

    it('completes checked page prerequisites for arbitrary users, preserving revocation and other accounts', async () => {
      const untouched = await service.read(targetId);
      for (let n = 0; n < 3; n++) {
        const subject = await db.user.create({
          data: {
            username: randomUUID(),
            displayName: 'Synthetic independent access user',
            passwordHash: 'not-a-login',
          },
        });
        const before = await service.read(subject.id);
        await service.save(
          subject.id,
          {
            revision: before.revision,
            title: 'No title-based grants',
            screenIds: [
              'customer-affairs.call-center',
              'integrations.section.connections',
            ],
            permissionCodes: [],
            allowedControlIds: [],
          },
          actor(),
        );
        const stored = await db.user.findUniqueOrThrow({
          where: { id: subject.id },
          include: manualUserInclude,
        });
        const permissions = authenticatedPermissionCodes(stored.roles);
        expect(canViewRoute(permissions, '/customer-affairs/call-center')).toBe(
          true,
        );
        expect(canViewRoute(permissions, '/integrations')).toBe(true);
        expect(visibleIntegrationSections(permissions)).toEqual([
          'connections',
        ]);
        expect(permissions).toEqual(
          expect.arrayContaining([
            'customer_affairs.call_center.read',
            'customer_affairs.call_center.contacts.read.own',
            'customer_affairs.call_center.reports.read.own',
            CALL_CENTER_SCOPED_ACCESS,
          ]),
        );
        expect(permissions).not.toContain(
          'customer_affairs.call_center.contacts.read.team',
        );
        expect(permissions).not.toContain(
          'customer_affairs.call_center.calls.create',
        );
        const checked = await service.read(subject.id);
        await service.save(
          subject.id,
          {
            revision: checked.revision,
            title: checked.title,
            screenIds: [],
            permissionCodes: [],
            allowedControlIds: [],
          },
          actor(),
        );
        const revoked = await db.user.findUniqueOrThrow({
          where: { id: subject.id },
          include: manualUserInclude,
        });
        const revokedPermissions = authenticatedPermissionCodes(revoked.roles);
        expect(
          canViewRoute(revokedPermissions, '/customer-affairs/call-center'),
        ).toBe(false);
        expect(canViewRoute(revokedPermissions, '/integrations')).toBe(false);
      }
      expect((await service.read(targetId)).revision).toBe(untouched.revision);
      const iam = new IamService(
        { client: db } as DatabaseService,
        {} as never,
        {} as never,
      );
      const created = await iam.createUser(
        {
          username: randomUUID(),
          displayName: 'Synthetic new-user checked views',
          password: `Synthetic-Only-${randomUUID()}-Aa9!`,
          manualAccessV3: true,
          accessTitle: 'Arbitrary',
          permissionIds: [],
          screenIds: [
            'customer-affairs.call-center',
            'integrations.section.connections',
          ],
          deniedControlIds: [],
          roleIds: [],
          branchIds: [],
        },
        actor(),
        {},
      );
      const newUser = await db.user.findUniqueOrThrow({
        where: { id: created.id },
        include: manualUserInclude,
      });
      const newPermissions = authenticatedPermissionCodes(newUser.roles);
      expect(
        canViewRoute(newPermissions, '/customer-affairs/call-center'),
      ).toBe(true);
      expect(visibleIntegrationSections(newPermissions)).toEqual([
        'connections',
      ]);
      expect(newPermissions).toContain(
        'customer_affairs.call_center.contacts.read.own',
      );
    }, 90000);

    it('opts only the edited user into sticky Call Center scope and preserves revisions/delegation/audit', async () => {
      const untouched = await service.read(targetId);
      const subject = await db.user.create({
        data: {
          username: randomUUID(),
          displayName: 'Synthetic Call Center target',
          passwordHash: 'not-a-login',
          roles: { create: { roleId: sharedId } },
        },
      });
      const before = await service.read(subject.id);
      const dto = {
        ...before.selection,
        revision: before.revision,
        title: 'Arbitrary title',
        screenIds: [
          ...before.selection.screenIds,
          'customer-affairs.call-center',
        ],
        permissionCodes: [
          ...before.selection.permissionCodes,
          'customer_affairs.call_center.read',
          'customer_affairs.call_center.contacts.read.own',
        ],
      };
      const restrictedRole = await db.role.create({
        data: {
          code: randomUUID(),
          name: 'Not a Call Center delegator',
          permissions: {
            create: { permission: { connect: { code: 'iam.users.manage' } } },
          },
        },
      });
      const restricted = await db.user.create({
        data: {
          username: randomUUID(),
          displayName: 'Synthetic limited delegator',
          passwordHash: 'not-a-login',
          roles: { create: { roleId: restrictedRole.id } },
        },
      });
      await expect(
        service.save(subject.id, dto, { ...actor(), userId: restricted.id }),
      ).rejects.toThrow();
      expect((await service.read(subject.id)).revision).toBe(before.revision);
      await service.save(subject.id, dto, actor());
      await expect(service.save(subject.id, dto, actor())).rejects.toThrow();
      const scoped = await service.read(subject.id);
      expect(scoped.selection.permissionCodes).toContain(
        CALL_CENTER_SCOPED_ACCESS,
      );
      await service.save(
        subject.id,
        {
          ...scoped.selection,
          revision: scoped.revision,
          title: scoped.title,
          permissionCodes: scoped.selection.permissionCodes.filter(
            (code) =>
              code !== CALL_CENTER_SCOPED_ACCESS &&
              code !== 'customer_affairs.call_center.contacts.read.own',
          ),
        },
        actor(),
      );
      expect(
        (await service.read(subject.id)).selection.permissionCodes,
      ).toContain(CALL_CENTER_SCOPED_ACCESS);
      expect(await service.read(targetId)).toEqual(untouched);
      expect(
        await db.auditEvent.count({
          where: {
            entityId: subject.id,
            action: 'iam.user.manual_access.update',
            outcome: 'SUCCESS',
          },
        }),
      ).toBe(2);
    }, 90000);

    it('protects the last effective access administrator even though the old administrator membership remains', async () => {
      const current = await service.read(adminId);
      for (const removed of ['iam.users.read', 'system.users']) {
        await expect(
          service.save(
            adminId,
            {
              ...current.selection,
              revision: current.revision,
              title: 'admin',
              permissionCodes: current.selection.permissionCodes.filter(
                (c) => c !== removed,
              ),
              screenIds: current.selection.screenIds.filter(
                (c) => c !== removed,
              ),
            },
            actor(),
          ),
        ).rejects.toThrow();
      }
      await expect(
        service.save(
          adminId,
          {
            ...current.selection,
            revision: current.revision,
            title: 'admin',
            permissionCodes: current.selection.permissionCodes.filter(
              (c) => c !== 'iam.users.manage',
            ),
          },
          actor(),
        ),
      ).rejects.toThrow();
      expect((await service.read(adminId)).selection.permissionCodes).toContain(
        'iam.users.manage',
      );
    });
  },
);
