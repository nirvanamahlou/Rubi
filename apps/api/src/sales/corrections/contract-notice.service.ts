import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../../database/database.service';

const fields = (value: Prisma.JsonValue) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};
@Injectable()
export class ContractNoticeService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  private authorize(actor: AuthenticatedActor, write = false) {
    if (
      !actor.permissions.includes('reservations.read') ||
      (write && !actor.permissions.includes('reservations.documents.manage'))
    )
      throw new ForbiddenException();
  }
  private async load(
    client: Pick<Prisma.TransactionClient, 'salesContract'>,
    id: string,
    actor: AuthenticatedActor,
  ) {
    const row = await client.salesContract.findFirst({
      where: { id, branchId: { in: actor.branchIds } },
      include: { services: { orderBy: { createdAt: 'asc' } } },
    });
    if (!row) throw new NotFoundException();
    return row;
  }
  async read(id: string, actor: AuthenticatedActor) {
    this.authorize(actor);
    const row = await this.load(this.db.client, id, actor);
    return {
      version: row.version,
      notice:
        row.services
          .map((s) => fields(s.metadata).contractNotice)
          .find((n): n is string => typeof n === 'string' && !!n.trim()) ?? '',
      canEdit:
        actor.permissions.includes('reservations.documents.manage') &&
        !['CANCELLED', 'DRAFT', 'PENDING_CONFIRMATION'].includes(row.status),
    };
  }
  async save(id: string, raw: unknown, actor: AuthenticatedActor) {
    this.authorize(actor, true);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new BadRequestException();
    const input = raw as { expectedVersion: number; notice: string };
    if (
      Object.keys(raw).some(
        (k) => !['expectedVersion', 'notice'].includes(k),
      ) ||
      !Number.isSafeInteger(input.expectedVersion) ||
      input.expectedVersion < 1 ||
      typeof input.notice !== 'string' ||
      input.notice.length > 5000
    )
      throw new BadRequestException();
    return this.db.client.$transaction(
      async (tx) => {
        const row = await this.load(tx, id, actor);
        if (
          !row.services.length ||
          ['CANCELLED', 'DRAFT', 'PENDING_CONFIRMATION'].includes(row.status) ||
          row.version !== input.expectedVersion
        )
          throw new ConflictException(
            'نسخه قرارداد تغییر کرده؛ آخرین نسخه را دریافت کنید.',
          );
        const result = await tx.salesContract.updateMany({
          where: { id, version: input.expectedVersion, status: row.status },
          data: { version: { increment: 1 } },
        });
        if (result.count !== 1)
          throw new ConflictException(
            'نسخه قرارداد تغییر کرده؛ آخرین نسخه را دریافت کنید.',
          );
        const notice = input.notice.trim();
        // Normalize duplicate historical copies so clearing cannot resurrect an older Notice.
        for (const service of row.services) {
          const metadata = fields(service.metadata);
          if (
            service !== row.services[0] &&
            !Object.hasOwn(metadata, 'contractNotice')
          )
            continue;
          await tx.salesContractService.update({
            where: { id: service.id },
            data: { metadata: { ...metadata, contractNotice: notice } },
          });
        }
        await tx.salesContractAuditEvent.create({
          data: {
            contractId: id,
            actorUserId: actor.userId,
            actorBranchId: row.branchId,
            action: 'sales.contract.updated',
            outcome: 'SUCCESS',
            reason: 'Contract Notice correction',
            beforeSnapshot: {
              version: row.version,
              notices: row.services.map((s) => ({
                serviceId: s.id,
                notice: fields(s.metadata).contractNotice ?? null,
              })),
            },
            afterSnapshot: {
              correction: 'NOTICE',
              version: row.version + 1,
              notice,
            },
          },
        });
        return { version: row.version + 1, notice, canEdit: true };
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
