import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  canViewRoute,
  hasScopedCallCenterAccess,
  type AuthenticatedActor,
} from '@nora/contracts';
import { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { IamWorkbenchRequestDirectory } from '../iam/iam-workbench-request-directory';
import { IamCallCenterDirectory } from '../iam/iam-call-center-directory';
import { answeredCallAccess } from '../iam/call-center-answer-policy';

type Purpose = 'contacts' | 'reports' | 'workflow';
@Injectable()
export class CallCenterAccessService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(IamWorkbenchRequestDirectory)
    private readonly directory: IamWorkbenchRequestDirectory,
    @Inject(IamCallCenterDirectory)
    private readonly accounts: IamCallCenterDirectory = new IamCallCenterDirectory(
      db,
    ),
  ) {}
  scoped(actor: AuthenticatedActor) {
    return answeredCallAccess() || hasScopedCallCenterAccess(actor.permissions);
  }
  authorize(actor: AuthenticatedActor, branchId: string) {
    if (
      !actor.branchIds.includes(branchId) ||
      !actor.permissions.includes('customer_affairs.call_center.read') ||
      !canViewRoute(actor.permissions, '/customer-affairs/call-center')
    )
      throw new ForbiddenException();
  }
  async users(
    actor: AuthenticatedActor,
    branchId: string,
    purpose: Purpose,
    tx?: Prisma.TransactionClient,
  ): Promise<string[] | null> {
    this.authorize(actor, branchId);
    if (await this.accounts.globalCallCenter(actor, tx)) return null;
    if (!this.scoped(actor)) return null; // Preserve pre-existing legacy grants; never infer from role label.
    await this.directory.callCenterOperator(actor, branchId, tx);
    const prefix =
      purpose === 'workflow' ? 'workflow.manage' : `${purpose}.read`;
    const permissions: readonly string[] = actor.permissions;
    const own =
      answeredCallAccess() ||
      permissions.includes(
        `customer_affairs.call_center.${purpose === 'workflow' ? prefix : prefix + '.own'}`,
      );
    const team = permissions.includes(
      `customer_affairs.call_center.${prefix}.team`,
    );
    if (!own && !team) throw new ForbiddenException();
    return [
      ...new Set([
        ...(own ? [actor.userId] : []),
        ...(team
          ? await this.directory.callCenterTeam(actor, branchId, tx)
          : []),
      ]),
    ];
  }
  async where(
    actor: AuthenticatedActor,
    branchId: string,
    purpose: Purpose = 'contacts',
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.CallCenterContactWhereInput> {
    const users = await this.users(actor, branchId, purpose, tx);
    return {
      branchId,
      ...(users
        ? answeredCallAccess()
          ? {
              calls: {
                some: {
                  answerResponsibilities: { some: { userId: { in: users } } },
                },
              },
            }
          : { ownerUserId: { in: users } }
        : {}),
    };
  }
  async contact(
    actor: AuthenticatedActor,
    branchId: string,
    id: string,
    purpose: Purpose = 'contacts',
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.db.client;
    // SHARE serializes reads/writes against permanent owner reassignment inside transactions.
    if (tx)
      await tx.$queryRaw`SELECT id FROM customer_affairs_call_contacts WHERE id=${id}::uuid FOR SHARE`;
    const contact = await client.callCenterContact.findFirst({
      where: { id, ...(await this.where(actor, branchId, purpose, tx)) },
    });
    if (!contact) throw new NotFoundException();
    return contact;
  }
  async sql(
    actor: AuthenticatedActor,
    branchId: string,
    purpose: Purpose,
    tx?: Prisma.TransactionClient,
  ) {
    const users = await this.users(actor, branchId, purpose, tx);
    if (answeredCallAccess())
      return users === null
        ? Prisma.sql`TRUE`
        : users.length
          ? Prisma.sql`EXISTS(SELECT 1 FROM call_center_answer_responsibilities ar
          JOIN customer_affairs_calls answered ON answered.id=ar."callId"
          WHERE answered.contact_id=c.id AND ar."userId" IN (${Prisma.join(users.map((id) => Prisma.sql`${id}::uuid`))}))`
          : Prisma.sql`FALSE`;
    if (purpose === 'reports' && users !== null)
      return users.length
        ? Prisma.sql`(a.created_by_user_id IN (${Prisma.join(users.map((id) => Prisma.sql`${id}::uuid`))}) OR EXISTS(SELECT 1 FROM call_center_telephony_sessions s WHERE s."callId"=a.id AND s."claimUserId" IN (${Prisma.join(users.map((id) => Prisma.sql`${id}::uuid`))})))`
        : Prisma.sql`FALSE`;
    return users === null
      ? Prisma.sql`TRUE`
      : users.length
        ? Prisma.sql`c.owner_user_id IN (${Prisma.join(users.map((id) => Prisma.sql`${id}::uuid`))})`
        : Prisma.sql`FALSE`;
  }
  async recipient(
    actor: AuthenticatedActor,
    branchId: string,
    userId: string,
    tx: Prisma.TransactionClient,
  ) {
    const users = await this.users(actor, branchId, 'workflow', tx);
    if (users && !users.includes(userId))
      throw new ForbiddenException('گیرنده خارج از تیم مجاز است.');
  }

  async requestWhere(
    actor: AuthenticatedActor,
    branchId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.CustomerAffairsTicketWhereInput> {
    const users = await this.users(actor, branchId, 'workflow', tx);
    if (users === null) return { branchId };
    return {
      branchId,
      callCenterContact: await this.where(actor, branchId, 'workflow', tx),
      OR: [
        { executionOwnerUserId: { in: users } },
        { executionOwnerUserId: null, createdByUserId: { in: users } },
      ],
    };
  }
  async request(
    actor: AuthenticatedActor,
    branchId: string,
    id: string,
    tx: Prisma.TransactionClient,
  ) {
    const row = await tx.customerAffairsTicket.findFirst({
      where: {
        id,
        category: 'CALL_CENTER_REQUEST',
        ...(await this.requestWhere(actor, branchId, tx)),
      },
    });
    if (!row) throw new NotFoundException();
    if (row.callCenterContactId)
      await this.contact(
        actor,
        branchId,
        row.callCenterContactId,
        'workflow',
        tx,
      );
    return row;
  }
}
