import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { IamCallCenterDirectory } from '../iam/iam-call-center-directory';
import { IamWorkbenchRequestDirectory } from '../iam/iam-workbench-request-directory';
import { CallCenterAccessService } from './call-center-access.service';
import { answeredCallAccess } from '../iam/call-center-answer-policy';
import type { CallCenterOwnerDto } from './call-center-owner.dto';

@Injectable()
export class CallCenterOwnerService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CallCenterAccessService)
    private readonly access: CallCenterAccessService,
    @Inject(IamCallCenterDirectory)
    private readonly directory: IamCallCenterDirectory,
    @Inject(IamWorkbenchRequestDirectory)
    private readonly teams: IamWorkbenchRequestDirectory,
  ) {}
  private branch(actor: AuthenticatedActor, branch?: string) {
    const id = branch ?? actor.branchIds[0];
    if (!id) throw new ForbiddenException();
    this.access.authorize(actor, id);
    return id;
  }
  async options(
    actor: AuthenticatedActor,
    requested: string | undefined,
    id: string,
  ) {
    const branchId = this.branch(actor, requested);
    const row = await this.db.client.callCenterContact.findFirst({
      where: { id, branchId },
    });
    if (!row) throw new NotFoundException();
    const canAssign = actor.permissions.includes(
      'customer_affairs.call_center.owner.assign',
    );
    const canChange = actor.permissions.includes(
      'customer_affairs.call_center.owner.change',
    );
    if (answeredCallAccess() || row.ownerUserId || !canAssign)
      await this.access.contact(actor, branchId, id);
    const users =
      (await this.access.users(actor, branchId, 'workflow')) ??
      (await this.directory.list(branchId)).map((user) => user.id);
    return {
      data: {
        ownerUserId: row.ownerUserId,
        version: row.ownerVersion,
        canAssign: !row.ownerUserId && canAssign && users.length > 0,
        canChange: !!row.ownerUserId && canChange && users.length > 0,
        users:
          canAssign || canChange
            ? (await this.directory.list(branchId)).filter((u) =>
                users.includes(u.id),
              )
            : [],
      },
    };
  }
  async save(
    actor: AuthenticatedActor,
    requested: string | undefined,
    id: string,
    input: CallCenterOwnerDto,
  ) {
    const branchId = this.branch(actor, requested);
    return this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM customer_affairs_call_contacts WHERE id=${id}::uuid FOR UPDATE`;
      const row = await tx.callCenterContact.findFirst({
        where: { id, branchId },
      });
      if (!row) throw new NotFoundException();
      const permission = row.ownerUserId
        ? 'customer_affairs.call_center.owner.change'
        : 'customer_affairs.call_center.owner.assign';
      if (!actor.permissions.includes(permission))
        throw new ForbiddenException();
      if (answeredCallAccess() || row.ownerUserId)
        await this.access.contact(actor, branchId, id, 'contacts', tx);
      const team =
        (await this.access.users(actor, branchId, 'workflow', tx)) ??
        (await this.directory.list(branchId, tx)).map((user) => user.id);
      if (!team.includes(input.ownerUserId))
        throw new ForbiddenException(
          'مسئول باید عضو فعال واحد سازمانی شما در همین شعبه باشد.',
        );
      await this.directory.resolve(tx, branchId, input.ownerUserId);
      if (row.ownerVersion !== input.expectedVersion)
        throw new ConflictException(
          'مسئول مخاطب تغییر کرده است؛ دوباره دریافت کنید.',
        );
      if (row.ownerUserId === input.ownerUserId)
        return {
          data: { ownerUserId: row.ownerUserId, version: row.ownerVersion },
        };
      const changed = await tx.callCenterContact.updateMany({
        where: { id, branchId, ownerVersion: input.expectedVersion },
        data: {
          ownerUserId: input.ownerUserId,
          ownerVersion: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new ConflictException();
      await tx.customerAffairsAuditEvent.create({
        data: {
          branchId,
          actorUserId: actor.userId,
          entityType: 'CALL_CENTER_CONTACT',
          entityId: id,
          action: row.ownerUserId ? 'OWNER_CHANGED' : 'OWNER_ASSIGNED',
          version: row.ownerVersion + 1,
          afterSnapshot: {
            previousOwnerUserId: row.ownerUserId,
            ownerUserId: input.ownerUserId,
          },
        },
      });
      return {
        data: { ownerUserId: input.ownerUserId, version: row.ownerVersion + 1 },
      };
    });
  }
  async history(
    actor: AuthenticatedActor,
    requested: string | undefined,
    id: string,
  ) {
    const branchId = this.branch(actor, requested);
    if (
      !actor.permissions.includes('customer_affairs.call_center.owner.history')
    )
      throw new ForbiddenException();
    await this.access.contact(actor, branchId, id);
    return {
      data: await this.db.client.customerAffairsAuditEvent.findMany({
        where: {
          branchId,
          entityType: 'CALL_CENTER_CONTACT',
          entityId: id,
          action: { in: ['OWNER_ASSIGNED', 'OWNER_CHANGED'] },
        },
        select: {
          id: true,
          occurredAt: true,
          version: true,
          actorUserId: true,
          action: true,
          afterSnapshot: true,
        },
        orderBy: { version: 'desc' },
        take: 100,
      }),
    };
  }
}
