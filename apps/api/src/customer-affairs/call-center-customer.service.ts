import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { CustomerService } from '../customers/customer.service';
import { CallCenterWorkflowService } from './call-center-workflow.service';
import { CallCenterService } from './call-center.service';
import { CallCenterCrypto } from './call-center.crypto';
import type { CallCenterCustomerLinkDto } from './call-center-customer.dto';
import { callCenterSourceActor } from '../iam/call-center-answer-policy';
@Injectable()
export class CallCenterCustomerService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(CustomerService) private readonly customers: CustomerService,
    @Inject(CallCenterWorkflowService)
    private readonly workflow: CallCenterWorkflowService,
    @Inject(CallCenterService) private readonly calls: CallCenterService,
    @Inject(CallCenterCrypto) private readonly crypto: CallCenterCrypto,
  ) {}
  async candidates(
    actor: AuthenticatedActor,
    branch: string | undefined,
    contactId: string,
  ) {
    const branchId = this.workflow.scope(actor, branch);
    if (this.workflow.access.scoped(actor))
      await this.workflow.access.contact(actor, branchId, contactId);
    const call = await this.db.client.callCenterCall.findFirst({
      where: { contactId, contact: { branchId } },
      orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }],
    });
    if (!call) throw new NotFoundException();
    const phone = this.calls.presentCall(call).phone;
    if (!phone) return { data: [], meta: { hasMore: false } };
    return this.customers.callCenterCandidates(
      phone,
      branchId,
      callCenterSourceActor(actor),
    );
  }
  async link(
    actor: AuthenticatedActor,
    branch: string | undefined,
    id: string,
    input: CallCenterCustomerLinkDto,
  ) {
    const branchId = this.workflow.scope(actor, branch, true);
    return this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${'cc-request:' + id},0))`;
      const row = await tx.customerAffairsTicket.findFirst({
        where: { id, branchId, category: 'CALL_CENTER_REQUEST' },
      });
      if (!row) throw new NotFoundException();
      if (this.workflow.access.scoped(actor))
        await this.workflow.access.request(actor, branchId, id, tx);
      if (this.workflow.access.scoped(actor))
        await this.workflow.access.contact(
          actor,
          branchId,
          row.callCenterContactId!,
          'workflow',
          tx,
        );
      // Validate current native Customers permission even on retries and clearing a link.
      if (!actor.permissions.includes('customers.read'))
        throw new BadRequestException('مجوز مشاهده مشتری لازم است.');
      const target = input.customerId
        ? await this.customers.callCenterReference(
            tx,
            input.customerId,
            branchId,
            callCenterSourceActor(actor),
          )
        : null;
      const fingerprint = this.crypto.fingerprint(
        JSON.stringify({ branchId, id, input }),
      );
      const prior = await tx.customerAffairsCommand.findUnique({
        where: {
          actorUserId_scope_idempotencyKey: {
            actorUserId: actor.userId,
            scope: 'cc.customer.v1',
            idempotencyKey: input.commandId,
          },
        },
      });
      if (prior) {
        if (prior.requestFingerprint !== fingerprint)
          throw new ConflictException();
        return {
          data: { id, customerId: row.customerId, version: row.version },
        };
      }
      if (row.version !== input.expectedVersion)
        throw new ConflictException(
          'درخواست تغییر کرده است؛ اطلاعات را تازه‌سازی کنید.',
        );
      if (row.status === 'CLOSED' || (target && !target.isActive))
        throw new BadRequestException('درخواست باز و مشتری فعال لازم است.');
      const updated = await tx.customerAffairsTicket.update({
        where: { id },
        data: {
          customerId: target?.id ?? null,
          version: { increment: 1 },
          updatedByUserId: actor.userId,
        },
      });
      await tx.customerAffairsCommand.create({
        data: {
          actorUserId: actor.userId,
          scope: 'cc.customer.v1',
          idempotencyKey: input.commandId,
          requestFingerprint: fingerprint,
          resultEntityId: id,
        },
      });
      await tx.customerAffairsAuditEvent.create({
        data: {
          branchId,
          entityType: 'CALL_CENTER_REQUEST',
          entityId: id,
          actorUserId: actor.userId,
          action: 'CUSTOMER_LINKED',
          version: updated.version,
          afterSnapshot: {
            previousCustomerId: row.customerId,
            customerId: target?.id ?? null,
          },
        },
      });
      return {
        data: { id, customerId: updated.customerId, version: updated.version },
      };
    });
  }
}
