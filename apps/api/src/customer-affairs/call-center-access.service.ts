import {
  callbackManagers,
  missedInbound,
  ringingExtensions,
} from './callback-triage';
import { CallCenterCrypto } from './call-center.crypto';
import type { TelephonyTechnical } from './telephony-state';
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
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
    @Optional()
    @Inject(CallCenterCrypto)
    private readonly callbackCrypto?: CallCenterCrypto,
  ) {}
  async callbackContactIds(
    actor: AuthenticatedActor,
    branchId: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (!this.callbackCrypto || !callbackManagers().length)
      return [] as string[];
    const db = tx ?? this.db.client;
    const manager = callbackManagers().includes(actor.userId);
    const ids = new Set<string>();
    let after: string | undefined;
    for (;;) {
      const rows = await db.callCenterTelephonySession.findMany({
        where: {
          synthetic: false,
          state: 'ENDED',
          call: {
            origin: 'TELEPHONY',
            direction: 'INBOUND',
            answerResponsibilities: { none: {} },
            contact: { branchId },
          },
          ...(after ? { id: { gt: after } } : {}),
        },
        include: { call: { select: { contactId: true } } },
        orderBy: { id: 'asc' },
        take: 200,
      });
      for (const row of rows) {
        const t = this.callbackCrypto.decrypt<TelephonyTechnical>(
          row.encryptedTechnical,
          row.keyVersion,
          `telephony:${row.id}`,
        );
        if (!missedInbound(t)) continue;
        const user = await this.singleRingingUser(branchId, t, db);
        if (user ? user === actor.userId : manager) ids.add(row.call.contactId);
      }
      if (rows.length < 200) break;
      after = rows.at(-1)!.id;
    }
    const assigned = await db.customerAffairsTicket.findMany({
      where: {
        branchId,
        category: 'CALL_CENTER_REQUEST',
        executionOwnerUserId: actor.userId,
        callCenterContactId: { not: null },
      },
      select: { callCenterContactId: true },
    });
    for (const row of assigned) ids.add(row.callCenterContactId!);
    return [...ids];
  }
  async singleRingingUser(
    branchId: string,
    t: TelephonyTechnical,
    tx?: Prisma.TransactionClient,
  ) {
    const extensions = ringingExtensions(t);
    if (!extensions.length) return null;
    const owners = await Promise.all(
      extensions.map((extension) =>
        this.accounts.answeredAccounts(
          branchId,
          extension,
          t.first.occurredAt,
          tx ?? this.db.client,
        ),
      ),
    );
    const users = [...new Set(owners.flat())];
    return owners.every((row) => row.length === 1) && users.length === 1
      ? users[0]!
      : null;
  }
  async canManageCallback(
    actor: AuthenticatedActor,
    branchId: string,
    contactId: string,
    tx?: Prisma.TransactionClient,
  ) {
    return (
      callbackManagers().includes(actor.userId) &&
      (await this.callbackContactIds(actor, branchId, tx)).includes(contactId)
    );
  }
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
    const callbacks = users
      ? await this.callbackContactIds(actor, branchId, tx)
      : [];
    const where: Prisma.CallCenterContactWhereInput = {
      branchId,
      ...(users
        ? answeredCallAccess()
          ? {
              calls: {
                some: {
                  OR: [
                    {
                      answerResponsibilities: {
                        some: { userId: { in: users } },
                      },
                    },
                    // For OUTBOUND only, ingestion validates the originating
                    // extension before recording a positive mapping snapshot.
                    // Manual transfers have version 0; inbound offers prove no answer.
                    {
                      origin: 'TELEPHONY',
                      direction: 'OUTBOUND',
                      telephonySession: {
                        synthetic: false,
                        offers: {
                          some: {
                            userId: { in: users },
                            mappingVersion: { gt: 0 },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            }
          : { ownerUserId: { in: users } }
        : {}),
    };
    return callbacks.length
      ? { branchId, OR: [where, { id: { in: callbacks } }] }
      : where;
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
    const callbacks = users
      ? await this.callbackContactIds(actor, branchId, tx)
      : [];
    if (answeredCallAccess()) {
      const evidence =
        users === null
          ? Prisma.sql`TRUE`
          : users.length
            ? Prisma.sql`(EXISTS(SELECT 1 FROM call_center_answer_responsibilities ar
          JOIN customer_affairs_calls answered ON answered.id=ar."callId"
          WHERE answered.contact_id=c.id AND ar."userId" IN (${Prisma.join(users.map((id) => Prisma.sql`${id}::uuid`))}))
          OR EXISTS(SELECT 1 FROM customer_affairs_calls outbound
          JOIN call_center_telephony_sessions s ON s."callId"=outbound.id
          JOIN call_center_telephony_offers o ON o."sessionId"=s.id
          WHERE outbound.contact_id=c.id AND outbound.origin='TELEPHONY'
          AND outbound.direction='OUTBOUND' AND s.synthetic=false AND o."mappingVersion">0
          AND o."userId" IN (${Prisma.join(users.map((id) => Prisma.sql`${id}::uuid`))})))`
            : Prisma.sql`FALSE`;
      return callbacks.length
        ? Prisma.sql`(${evidence} OR c.id IN (${Prisma.join(callbacks.map((id) => Prisma.sql`${id}::uuid`))}))`
        : evidence;
    }
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
    if (
      users &&
      !users.includes(userId) &&
      !callbackManagers().includes(actor.userId)
    )
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
      OR: [
        ...((await this.canReviewCreatedRequest(actor, branchId, tx))
          ? [{ createdByUserId: actor.userId, callCenterReviews: { some: {} } }]
          : []),
        {
          callCenterContact: await this.where(actor, branchId, 'workflow', tx),
          OR: [
            ...(callbackManagers().includes(actor.userId)
              ? [
                  {
                    callCenterContactId: {
                      in: await this.callbackContactIds(actor, branchId, tx),
                    },
                  },
                ]
              : []),
            { executionOwnerUserId: { in: users } },
            { executionOwnerUserId: null, createdByUserId: { in: users } },
          ],
        },
      ],
    };
  }
  /** A creator's review grants access to that request, never the whole contact history. */
  async canReviewCreatedRequest(
    actor: AuthenticatedActor,
    branchId: string,
    tx?: Prisma.TransactionClient,
  ) {
    this.authorize(actor, branchId);
    if (
      !actor.permissions.includes(
        'customer_affairs.call_center.workflow.manage',
      )
    )
      return false;
    if (callbackManagers().includes(actor.userId)) {
      await this.directory.callCenterOperator(actor, branchId, tx);
      return true;
    }
    return this.accounts.canManageRequest(actor, branchId, actor.userId, tx);
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
    return row;
  }
}
