import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { B2bOrganizationUserInput } from '@rubi/contracts';
import type { Prisma } from '@rubi/database';
import { DatabaseService } from '../database/database.service';
const snapshot = (row: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(row)) as Prisma.InputJsonValue;
@Injectable()
export class B2bOrganizationUserRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  byUser(userId: string) {
    return this.database.client.b2bOrganizationUser.findUnique({
      where: { userId },
    });
  }
  list(organizationId: string, branchId: string) {
    return this.database.client.b2bOrganizationUser.findMany({
      where: { organizationId, branchId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }
  async save(
    organizationId: string,
    input: B2bOrganizationUserInput,
    actorUserId: string,
    id?: string,
    userId?: string,
  ) {
    return this.database.client.$transaction(async (tx) => {
      const scope = { organizationId, branchId: input.branchId };
      const before = id
        ? await tx.b2bOrganizationUser.findFirst({ where: { id, ...scope } })
        : null;
      if (id && !before)
        throw new NotFoundException('کاربر در این پرونده یافت نشد.');
      const data = {
        roleName: input.roleName.trim(),
        sections: input.sections,
        isActive: input.isActive,
        updatedByUserId: actorUserId,
      };
      if (id) {
        if (!input.version)
          throw new ConflictException('نسخه اطلاعات لازم است.');
        const changed = await tx.b2bOrganizationUser.updateMany({
          where: { id, ...scope, version: input.version },
          data: { ...data, version: { increment: 1 } },
        });
        if (changed.count !== 1)
          throw new ConflictException(
            'دسترسی این کاربر تغییر کرده است؛ تازه‌سازی کنید.',
          );
      }
      const row = id
        ? await tx.b2bOrganizationUser.findUniqueOrThrow({ where: { id } })
        : await tx.b2bOrganizationUser.create({
            data: {
              ...scope,
              ...data,
              userId: userId!,
              createdByUserId: actorUserId,
            },
          });
      await tx.b2bAuditEvent.create({
        data: {
          actorUserId,
          branchId: input.branchId,
          action: id
            ? 'b2b.organization_user.update'
            : 'b2b.organization_user.create',
          entityType: 'B2bOrganizationUser',
          entityId: row.id,
          ...(before ? { beforeSnapshot: snapshot(before) } : {}),
          afterSnapshot: { record: snapshot(row), reason: input.reason.trim() },
        },
      });
      return row;
    });
  }
  history(organizationId: string, branchId: string, ids: string[]) {
    return this.database.client.b2bAuditEvent.findMany({
      where: {
        branchId,
        entityType: 'B2bOrganizationUser',
        entityId: { in: ids },
        OR: [
          {
            afterSnapshot: {
              path: ['record', 'organizationId'],
              equals: organizationId,
            },
          },
          {
            beforeSnapshot: {
              path: ['organizationId'],
              equals: organizationId,
            },
          },
        ],
      },
      select: { id: true, action: true, occurredAt: true },
      orderBy: { occurredAt: 'desc' },
      take: 50,
    });
  }
}
