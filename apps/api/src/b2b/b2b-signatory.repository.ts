import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@rubi/database';
import { DatabaseService } from '../database/database.service';

export interface SignatoryScope {
  organizationId: string;
  branchId: string;
}
export interface SignatoryWrite {
  contactId: string;
  documentTypes: string[];
  authorityLimit: Prisma.Decimal | null;
  currencyCode: string | null;
  validFrom: Date;
  validTo: Date | null;
  documentVersionId: string | null;
  isActive: boolean;
  notes: string;
}
const snapshot = (row: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(row)) as Prisma.InputJsonValue;
@Injectable()
export class B2bSignatoryRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  list(scope: SignatoryScope) {
    return this.database.client.b2bOrganizationSignatory.findMany({
      where: scope,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }
  find(scope: SignatoryScope, id: string) {
    return this.database.client.b2bOrganizationSignatory.findFirst({
      where: { ...scope, id },
    });
  }
  async save(
    scope: SignatoryScope,
    data: SignatoryWrite,
    actorUserId: string,
    id?: string,
    expectedVersion?: number,
  ) {
    return this.database.client.$transaction(async (tx) => {
      const before = id
        ? await tx.b2bOrganizationSignatory.findFirst({
            where: { ...scope, id },
          })
        : null;
      if (id && !before)
        throw new NotFoundException('امضادار در این پرونده و شعبه یافت نشد.');
      if (id) {
        if (!expectedVersion)
          throw new ConflictException('نسخه امضادار برای ویرایش لازم است.');
        const changed = await tx.b2bOrganizationSignatory.updateMany({
          where: { ...scope, id, version: expectedVersion },
          data: {
            ...data,
            updatedByUserId: actorUserId,
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1)
          throw new ConflictException(
            'اطلاعات امضادار هم‌زمان تغییر کرده است؛ تازه‌سازی کنید.',
          );
      }
      const row = id
        ? await tx.b2bOrganizationSignatory.findUniqueOrThrow({ where: { id } })
        : await tx.b2bOrganizationSignatory.create({
            data: {
              ...scope,
              ...data,
              createdByUserId: actorUserId,
              updatedByUserId: actorUserId,
            },
          });
      await tx.b2bAuditEvent.create({
        data: {
          actorUserId,
          branchId: scope.branchId,
          action: id ? 'b2b.signatory.update' : 'b2b.signatory.create',
          entityType: 'B2bOrganizationSignatory',
          entityId: row.id,
          ...(before ? { beforeSnapshot: snapshot(before) } : {}),
          afterSnapshot: snapshot(row),
        },
      });
      return row;
    });
  }
  async remove(
    scope: SignatoryScope,
    id: string,
    version: number,
    actorUserId: string,
    reason: string,
  ) {
    return this.database.client.$transaction(async (tx) => {
      const before = await tx.b2bOrganizationSignatory.findFirst({
        where: { ...scope, id },
      });
      if (!before)
        throw new NotFoundException('امضادار در این پرونده و شعبه یافت نشد.');
      const deleted = await tx.b2bOrganizationSignatory.deleteMany({
        where: { ...scope, id, version },
      });
      if (deleted.count !== 1)
        throw new ConflictException(
          'اطلاعات امضادار هم‌زمان تغییر کرده است؛ تازه‌سازی کنید.',
        );
      await tx.b2bAuditEvent.create({
        data: {
          actorUserId,
          branchId: scope.branchId,
          action: 'b2b.signatory.delete',
          entityType: 'B2bOrganizationSignatory',
          entityId: id,
          beforeSnapshot: snapshot(before),
          afterSnapshot: { deleted: true, reason },
        },
      });
      return { id, deleted: true };
    });
  }
}
