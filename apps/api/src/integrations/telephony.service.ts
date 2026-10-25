import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import type { AuthenticatedActor, TelephonyEventV1 } from '@nora/contracts';
import { DatabaseService } from '../database/database.service';
import { IamCallCenterDirectory } from '../iam/iam-call-center-directory';
import { IamWorkbenchRequestDirectory } from '../iam/iam-workbench-request-directory';
import { CallCenterTelephonyService } from '../customer-affairs/call-center-telephony.service';
import { IntegrationRegistryService } from './integration-registry.service';
import { validateTelephonyEvent } from './telephony.validation';
import {
  recordNativeAnswer,
  selectPreviousAgent,
  type MemberSnapshot,
} from './issabel/sticky-sales';

type Envelope = {
  event: TelephonyEventV1;
  recipient: { userId: string; version: number; teamId: string | null } | null;
  historical?: true;
};
@Injectable()
export class TelephonyIntegrationService {
  private readonly logger = new Logger(TelephonyIntegrationService.name);
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(CallCenterTelephonyService)
    private readonly domain: CallCenterTelephonyService,
    @Inject(IntegrationRegistryService)
    private readonly registry: IntegrationRegistryService,
    @Inject(IamCallCenterDirectory)
    private readonly directory: IamCallCenterDirectory,
    @Inject(IamWorkbenchRequestDirectory)
    private readonly teams: IamWorkbenchRequestDirectory,
  ) {}
  syntheticEnabled() {
    return (
      ['development', 'test'].includes(
        this.config.get<string>('NODE_ENV') ?? '',
      ) && this.config.get<string>('TELEPHONY_SYNTHETIC_ENABLED') === 'true'
    );
  }
  private admin(actor: AuthenticatedActor) {
    if (!this.registry.canManage(actor)) throw new ForbiddenException();
  }
  async settings(actor: AuthenticatedActor) {
    this.domain.authorize(actor);
    const canManage = this.registry.canManage(actor);
    return {
      state: 'NOT_CONNECTED',
      syntheticEnabled: this.syntheticEnabled(),
      canManage,
      connections: canManage
        ? await this.db.client.integrationTelephonyConnection.findMany({
            where: { branchId: { in: [...actor.branchIds] } },
            include: { mappings: true },
            take: 100,
          })
        : [],
    };
  }
  async configure(
    actor: AuthenticatedActor,
    input: {
      id?: string;
      branchId: string;
      name: string;
      version?: number;
      maxAgeSeconds: number;
      maxFutureSeconds: number;
    },
  ) {
    this.admin(actor);
    if (!actor.branchIds.includes(input.branchId))
      throw new ForbiddenException();
    return this.db.client.$transaction(async (tx) => {
      const id = input.id ?? randomUUID();
      if (input.id) {
        const changed = await tx.integrationTelephonyConnection.updateMany({
          where: {
            id,
            branchId: input.branchId,
            version: input.version ?? 0,
            synthetic: false,
          },
          data: {
            name: input.name,
            maxAgeSeconds: input.maxAgeSeconds,
            maxFutureSeconds: input.maxFutureSeconds,
            version: { increment: 1 },
          },
        });
        if (!changed.count) throw new ConflictException();
      } else
        await tx.integrationTelephonyConnection.create({
          data: {
            id,
            branchId: input.branchId,
            createdByUserId: actor.userId,
            name: input.name,
            maxAgeSeconds: input.maxAgeSeconds,
            maxFutureSeconds: input.maxFutureSeconds,
            active: false,
          },
        });
      await tx.integrationTelephonyAudit.create({
        data: {
          connectionId: id,
          actorUserId: actor.userId,
          entityId: id,
          action: 'CONFIGURE',
          metadata: { version: input.version ?? 0 },
        },
      });
      return { id, state: 'NOT_CONNECTED' };
    });
  }
  async mapping(
    actor: AuthenticatedActor,
    input: {
      connectionId: string;
      extension: string;
      userId: string;
      teamId?: string;
      active: boolean;
      version: number;
    },
  ) {
    this.admin(actor);
    return this.db.client.$transaction(async (tx) => {
      const c = await tx.integrationTelephonyConnection.findFirst({
        where: {
          id: input.connectionId,
          branchId: { in: [...actor.branchIds] },
          synthetic: false,
        },
      });
      if (!c) throw new NotFoundException();
      if (input.active)
        await this.directory.resolve(tx, c.branchId, input.userId);
      if (input.teamId) {
        const options = await this.teams.options(actor, c.branchId, tx);
        if (
          !options.units.some(
            (u) =>
              u.id === input.teamId &&
              u.users.some((v) => v.id === input.userId),
          )
        )
          throw new BadRequestException('کارشناس عضو تیم انتخاب‌شده نیست.');
      }
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${'telephony:mapping:' + c.id + ':' + input.extension},0))`;
      const prior = await tx.integrationTelephonyMapping.findUnique({
        where: {
          connectionId_extension: {
            connectionId: c.id,
            extension: input.extension,
          },
        },
      });
      if ((prior?.version ?? 0) !== input.version)
        throw new ConflictException();
      const row = await tx.integrationTelephonyMapping.upsert({
        where: {
          connectionId_extension: {
            connectionId: c.id,
            extension: input.extension,
          },
        },
        create: {
          connectionId: c.id,
          extension: input.extension,
          userId: input.userId,
          teamId: input.teamId ?? null,
          active: input.active,
        },
        update: {
          userId: input.userId,
          teamId: input.teamId ?? null,
          active: input.active,
          version: { increment: 1 },
        },
      });
      await tx.integrationTelephonyAudit.create({
        data: {
          connectionId: c.id,
          actorUserId: actor.userId,
          entityId: row.id,
          action: 'MAPPING',
          metadata: {
            before: prior
              ? {
                  userId: prior.userId,
                  teamId: prior.teamId,
                  version: prior.version,
                  active: prior.active,
                }
              : null,
            after: {
              userId: row.userId,
              teamId: row.teamId,
              version: row.version,
              active: row.active,
            },
          },
        },
      });
      return row;
    });
  }
  /** Adapter-facing in-process port. There is deliberately no public provider webhook. */
  async receive(input: TelephonyEventV1, provider?: 'ISSABEL' | 'RELAY') {
    return this.receiveInternal(input, provider, false);
  }
  /** Only a verified server-side recovery adapter may call this port. No HTTP route. */
  async receiveRecovered(input: TelephonyEventV1) {
    if (this.config.get<string>('ISSABEL_RECOVERY_ENABLED') !== 'true')
      throw new ForbiddenException('Telephony recovery is disabled.');
    // Separate receipt namespace from AMI, but retain the identical PBX root so
    // live/recovered evidence projects into one call. Never replay a live offer.
    const event = validateTelephonyEvent(
      input,
      { maxAgeSeconds: 0, maxFutureSeconds: 0 },
      new Date(),
      false,
    );
    const receipt = await this.receiveInternal(
      {
        ...event,
        externalEventId:
          'cdr-recovery:' +
          createHash('sha256').update(event.externalEventId).digest('hex'),
      },
      'ISSABEL',
      true,
    );
    await this.process(receipt.id);
    const row = await this.db.client.integrationTelephonyInbox.findUnique({
      where: { id: receipt.id },
      select: { status: true },
    });
    if (row?.status !== 'DONE')
      throw new ConflictException('Recovery projection is incomplete.');
  }
  private async receiveInternal(
    input: TelephonyEventV1,
    provider: 'ISSABEL' | 'RELAY' | undefined,
    recovery: boolean,
  ) {
    const c = await this.db.client.integrationTelephonyConnection.findUnique({
      where: { id: input.connectionId },
    });
    const prefix = provider === 'RELAY' ? 'TELEPHONY_RELAY' : 'ISSABEL';
    const realProvider =
      !!provider &&
      this.config.get<string>(`${prefix}_ENABLED`) === 'true' &&
      this.config.get<string>(`${prefix}_CONNECTION_ID`) === c?.id &&
      !c?.synthetic;
    if (
      !c ||
      !c.active ||
      !(realProvider || (c.synthetic && this.syntheticEnabled()))
    )
      throw new ForbiddenException(
        'No verified provider adapter is configured.',
      );
    // Validate structure before hashing; already accepted receipts remain retryable
    // after the ingress age window. New identities still obey the clock policy.
    const event = validateTelephonyEvent(input, c, new Date(), false);
    if (!recovery && event.externalEventId.startsWith('cdr-recovery:'))
      throw new BadRequestException('Reserved recovery identity.');
    const crypto = this.domain.crypto,
      externalFingerprint = crypto.fingerprint(
        `telephony:event:${c.id}:${event.externalEventId}`,
      ),
      payloadFingerprint = crypto.fingerprint(JSON.stringify(event));
    return this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${'telephony:ingress:' + c.id},0))`;
      const prior = await tx.integrationTelephonyInbox.findUnique({
        where: {
          connectionId_externalFingerprint: {
            connectionId: c.id,
            externalFingerprint,
          },
        },
      });
      if (prior) {
        if (prior.payloadFingerprint !== payloadFingerprint)
          throw new ConflictException('Event identity collision.');
        return { id: prior.id, duplicate: true };
      }
      if (recovery) {
        // Historical age is allowed only on the private recovery port. Future
        // timestamps remain forbidden; ordinary ingress keeps its original policy.
        if (Date.parse(event.occurredAt) > Date.now())
          throw new BadRequestException('Recovery event is in the future.');
      } else validateTelephonyEvent(event, c);
      const count = await tx.integrationTelephonyInbox.count({
        where: {
          connectionId: c.id,
          receivedAt: { gte: new Date(Date.now() - 60000) },
        },
      });
      const configuredLimit = Number(
        this.config.get<string>('TELEPHONY_EVENTS_PER_MINUTE') ?? 120,
      );
      const limit =
        !c.synthetic &&
        Number.isInteger(configuredLimit) &&
        configuredLimit >= 120 &&
        configuredLimit <= 6000
          ? configuredLimit
          : 120;
      if (count >= limit)
        throw new HttpException(
          'Telephony connection rate limit exceeded.',
          429,
        );
      const captureOnly =
        provider === 'ISSABEL' &&
        this.config.get<string>('ISSABEL_EVENT_MODE') ===
          'NATIVE_QUEUE_CAPTURE';
      const mapping =
        !recovery &&
        event.extension &&
        (!captureOnly ||
          this.config.get<string>('ISSABEL_USER_NOTIFICATIONS_ENABLED') ===
            'true' ||
          (event.direction === 'OUT' &&
            this.config.get<string>(
              'ISSABEL_OUTBOUND_NOTIFICATIONS_ENABLED',
            ) === 'true'))
          ? await tx.integrationTelephonyMapping.findUnique({
              where: {
                connectionId_extension: {
                  connectionId: c.id,
                  extension: event.extension,
                },
              },
            })
          : null;
      const eligible = mapping?.active
        ? await this.directory.eligibleMapping(
            c.branchId,
            mapping.userId,
            mapping.teamId,
            tx,
          )
        : false;
      const envelope: Envelope = {
        event,
        ...(recovery ? { historical: true as const } : {}),
        recipient:
          eligible && mapping
            ? {
                userId: mapping.userId,
                version: mapping.version,
                teamId: mapping.teamId,
              }
            : null,
      };
      const id = randomUUID();
      await tx.integrationTelephonyInbox.create({
        data: {
          id,
          connectionId: c.id,
          externalFingerprint,
          payloadFingerprint,
          encryptedPayload: crypto.encrypt(envelope, `telephony:inbox:${id}`),
          keyVersion: crypto.keyVersion,
          dispatch: { create: {} },
        },
      });
      if (captureOnly && !recovery)
        await recordNativeAnswer(tx, crypto, event, id);
      return { id, duplicate: false };
    });
  }
  /** Admin/internal preview only; no public PBX endpoint and no dial action. */
  async preferredAgent(
    actor: AuthenticatedActor,
    connectionId: string,
    queue: string,
    phone: string,
    availability: MemberSnapshot | null,
  ) {
    this.admin(actor);
    this.domain.authorize(actor);
    const connection =
      await this.db.client.integrationTelephonyConnection.findFirst({
        where: {
          id: connectionId,
          branchId: { in: [...actor.branchIds] },
          active: true,
          synthetic: false,
        },
        select: { id: true },
      });
    if (!connection) throw new NotFoundException();
    const queues = (this.config.get<string>('ISSABEL_INBOUND_QUEUES') ?? '')
      .split(',')
      .map((v) => v.trim());
    if (
      this.config.get<string>('ISSABEL_ENABLED') !== 'true' ||
      this.config.get<string>('ISSABEL_EVENT_MODE') !==
        'NATIVE_QUEUE_CAPTURE' ||
      this.config.get<string>('ISSABEL_CONNECTION_ID') !== connectionId ||
      !queues.includes(queue) ||
      !/^[a-zA-Z0-9_.:-]{1,100}$/.test(queue)
    )
      throw new ForbiddenException();
    return selectPreviousAgent(
      this.db.client,
      this.domain.crypto,
      connectionId,
      queue,
      phone,
      availability,
    );
  }
  /** Integrations-owned receipt lookup for native AMI correlation/restart recovery. */
  async acceptedEvent(
    connectionId: string,
    externalEventId: string,
  ): Promise<TelephonyEventV1 | null> {
    const row = await this.db.client.integrationTelephonyInbox.findUnique({
      where: {
        connectionId_externalFingerprint: {
          connectionId,
          externalFingerprint: this.domain.crypto.fingerprint(
            `telephony:event:${connectionId}:${externalEventId}`,
          ),
        },
      },
    });
    if (!row) return null;
    // A tombstone must not be mistaken for a new call after private retention expiry.
    if (!row.encryptedPayload)
      throw new ConflictException('Telephony correlation expired.');
    return this.domain.crypto.decrypt<Envelope>(
      row.encryptedPayload,
      row.keyVersion,
      `telephony:inbox:${row.id}`,
    ).event;
  }
  async pending() {
    // Processed canonical private input expires after seven days; HMAC dedupe tombstones remain.
    await this.db.client.integrationTelephonyInbox.updateMany({
      where: {
        status: 'DONE',
        processedAt: { lt: new Date(Date.now() - 7 * 86400000) },
        encryptedPayload: { not: null },
      },
      data: { encryptedPayload: null },
    });
    await this.db.client.integrationTelephonyInbox.updateMany({
      where: {
        status: 'DEAD',
        receivedAt: { lt: new Date(Date.now() - 30 * 86400000) },
        encryptedPayload: { not: null },
      },
      data: { encryptedPayload: null, errorCode: 'PAYLOAD_EXPIRED' },
    });
    return this.db.client.integrationTelephonyOutbox.findMany({
      where: { completedAt: null, availableAt: { lte: new Date() } },
      select: { inboxId: true },
      orderBy: { availableAt: 'asc' },
      take: 50,
    });
  }
  async process(id: string) {
    try {
      return await this.db.client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM integration_telephony_inbox WHERE id=${id}::uuid FOR UPDATE`;
        const row = await tx.integrationTelephonyInbox.findUnique({
          where: { id },
          include: { connection: true, dispatch: true },
        });
        if (
          !row ||
          row.status === 'DONE' ||
          row.status === 'DEAD' ||
          !row.encryptedPayload ||
          !row.dispatch ||
          row.dispatch.availableAt > new Date()
        )
          return { processed: false };
        const envelope = this.domain.crypto.decrypt<Envelope>(
          row.encryptedPayload,
          row.keyVersion,
          `telephony:inbox:${id}`,
        );
        const sessionId = await this.domain.project(tx, envelope.event, {
          branchId: row.connection.branchId,
          creatorId: row.connection.createdByUserId,
          synthetic: row.connection.synthetic,
          receivedAt: row.receivedAt,
          recipient: envelope.historical ? null : envelope.recipient,
        });
        await tx.integrationTelephonyAudit.create({
          data: {
            connectionId: row.connectionId,
            entityId: id,
            action: 'PROCESSED',
            metadata: {
              sessionId,
              kind: envelope.event.kind,
              receivedAt: row.receivedAt.toISOString(),
            },
          },
        });
        await tx.integrationTelephonyInbox.update({
          where: { id },
          data: {
            status: 'DONE',
            processedAt: new Date(),
            attempts: { increment: 1 },
            errorCode: null,
          },
        });
        await tx.integrationTelephonyOutbox.update({
          where: { inboxId: id },
          data: { completedAt: new Date() },
        });
        return { processed: true };
      });
    } catch (error) {
      const permanent =
        error instanceof BadRequestException ||
        error instanceof ConflictException;
      await this.db.client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM integration_telephony_inbox WHERE id=${id}::uuid FOR UPDATE`;
        const row = await tx.integrationTelephonyInbox.findUnique({
          where: { id },
        });
        if (!row || row.status === 'DONE' || row.status === 'DEAD') return;
        const attempts = row.attempts + 1,
          dead = permanent || attempts >= 6;
        await tx.integrationTelephonyInbox.update({
          where: { id },
          data: {
            attempts,
            status: dead ? 'DEAD' : 'RETRY',
            errorCode:
              error instanceof ConflictException
                ? 'CONFLICT'
                : permanent
                  ? 'INVALID_DATA'
                  : 'TEMPORARY',
          },
        });
        await tx.integrationTelephonyOutbox.update({
          where: { inboxId: id },
          data: {
            availableAt: new Date(
              Date.now() +
                Math.min(300000, 1000 * 2 ** attempts) +
                Math.floor(Math.random() * 1000),
            ),
            completedAt: dead ? new Date() : null,
          },
        });
        if (dead) {
          await tx.integrationTelephonyAudit.create({
            data: {
              connectionId: row.connectionId,
              entityId: id,
              action: 'DEAD_LETTER',
              metadata: { attempts },
            },
          });
          this.logger.warn(`Telephony dead letter ${id}`);
        }
      });
      return { processed: false };
    }
  }
  async operations(actor: AuthenticatedActor) {
    this.admin(actor);
    return {
      health: await this.health(actor),
      unassigned: await this.domain.review(actor.branchIds),
      dead: await this.db.client.integrationTelephonyInbox.findMany({
        where: {
          status: 'DEAD',
          connection: { branchId: { in: [...actor.branchIds] } },
        },
        select: {
          id: true,
          connectionId: true,
          attempts: true,
          errorCode: true,
          receivedAt: true,
        },
        take: 50,
      }),
      audit: await this.db.client.integrationTelephonyAudit.findMany({
        where: { connection: { branchId: { in: [...actor.branchIds] } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    };
  }
  /** Authorized operational counters; no payload decrypts or private fields. */
  async health(actor: AuthenticatedActor) {
    this.admin(actor);
    this.domain.authorize(actor);
    const scoped = {
      connection: { branchId: { in: [...actor.branchIds] }, synthetic: false },
    };
    const now = new Date();
    const [groups, oldest, commands, uploading, expired, unpublished] =
      await this.db.client.$transaction(
        [
          this.db.client.integrationTelephonyInbox.groupBy({
            by: ['status'],
            where: scoped,
            _count: true,
          }),
          this.db.client.integrationTelephonyInbox.findFirst({
            where: { ...scoped, status: { in: ['PENDING', 'RETRY'] } },
            orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
            select: { receivedAt: true },
          }),
          this.db.client.integrationTelephonyCommand.count({
            where: { ...scoped, state: 'UNKNOWN' },
          }),
          this.db.client.integrationTelephonyRecording.count({
            where: { ...scoped, state: 'UPLOADING' },
          }),
          this.db.client.integrationTelephonyRecording.count({
            where: { ...scoped, expiresAt: { lte: now } },
          }),
          this.db.client.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*) AS count FROM integration_telephony_recordings r
        JOIN integration_telephony_connections c ON c.id=r."connectionId"
        WHERE c."branchId"=ANY(${[...actor.branchIds]}::uuid[]) AND NOT c.synthetic
          AND r.state='COMPLETE' AND r."expiresAt">${now} AND NOT EXISTS (
            SELECT 1 FROM integration_telephony_audit a WHERE a."connectionId"=r."connectionId"
              AND a."entityId"=r.id AND a.action='RECORDING_PUBLISHED')`,
        ],
        { isolationLevel: 'RepeatableRead' },
      );
    const count = (status: string) =>
      groups.find((group) => group.status === status)?._count ?? 0;
    const oldestPendingSeconds = oldest
      ? Math.max(
          0,
          Math.floor((now.getTime() - oldest.receivedAt.getTime()) / 1000),
        )
      : null;
    const alerts: string[] = [];
    if (count('DEAD')) alerts.push('DEAD_LETTER');
    if (oldestPendingSeconds !== null && oldestPendingSeconds >= 60)
      alerts.push('PROCESSING_DELAY');
    if (commands) alerts.push('COMMAND_OUTCOME_UNKNOWN');
    if (expired) alerts.push('RETENTION_OVERDUE');
    if (Number(unpublished[0]?.count ?? 0))
      alerts.push('RECORDING_PUBLICATION_PENDING');
    return {
      asOf: now.toISOString(),
      scope: 'authorized branches; excludes synthetic',
      state: alerts.length ? 'ATTENTION_REQUIRED' : 'NO_INTERNAL_ALERT',
      pending: count('PENDING'),
      retrying: count('RETRY'),
      dead: count('DEAD'),
      processed: count('DONE'),
      oldestPendingSeconds,
      unknownCommands: commands,
      uploadingRecordings: uploading,
      expiredRecordings: expired,
      unpublishedRecordings: Number(unpublished[0]?.count ?? 0),
      alerts,
      providerCoverage: 'NOT_VERIFIED',
      liveAcceptance: false,
    };
  }
  async replay(actor: AuthenticatedActor, id: string) {
    this.admin(actor);
    return this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM integration_telephony_inbox WHERE id=${id}::uuid FOR UPDATE`;
      const row = await tx.integrationTelephonyInbox.findFirst({
        where: {
          id,
          status: 'DEAD',
          connection: { branchId: { in: [...actor.branchIds] } },
        },
      });
      if (!row || !row.encryptedPayload) throw new NotFoundException();
      await tx.integrationTelephonyInbox.update({
        where: { id },
        data: { status: 'PENDING', attempts: 0, errorCode: null },
      });
      await tx.integrationTelephonyOutbox.update({
        where: { inboxId: id },
        data: { completedAt: null, availableAt: new Date() },
      });
      await tx.integrationTelephonyAudit.create({
        data: {
          connectionId: row.connectionId,
          actorUserId: actor.userId,
          entityId: id,
          action: 'REPLAY',
          metadata: {},
        },
      });
      return { ok: true };
    });
  }
  async synthetic(
    actor: AuthenticatedActor,
    branchId: string,
    kind: TelephonyEventV1['kind'],
    rootId: string | null,
    externalEventId: string,
    anonymous = false,
  ) {
    if (!this.syntheticEnabled()) throw new NotFoundException();
    this.domain.authorize(actor, true);
    if (!actor.branchIds.includes(branchId)) throw new ForbiddenException();
    const c = await this.db.client.$transaction(async (tx) => {
      await this.directory.resolve(tx, branchId, actor.userId);
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${'telephony:synthetic:' + actor.userId + branchId},0))`;
      const existing = await tx.integrationTelephonyConnection.findFirst({
        where: { synthetic: true, branchId, createdByUserId: actor.userId },
      });
      const connection =
        existing ??
        (await tx.integrationTelephonyConnection.create({
          data: {
            branchId,
            createdByUserId: actor.userId,
            name: 'Synthetic development harness',
            synthetic: true,
            active: true,
          },
        }));
      await tx.integrationTelephonyMapping.upsert({
        where: {
          connectionId_extension: {
            connectionId: connection.id,
            extension: 'TEST',
          },
        },
        create: {
          connectionId: connection.id,
          extension: 'TEST',
          userId: actor.userId,
        },
        update: {},
      });
      return connection;
    });
    const callId = rootId ?? randomUUID();
    const event: TelephonyEventV1 = {
      schemaVersion: 1,
      connectionId: c.id,
      externalEventId,
      externalCallId: callId,
      rootCallId: callId,
      legId: 'leg-1',
      kind,
      direction: 'IN',
      caller: anonymous
        ? { kind: 'WITHHELD', value: null }
        : { kind: 'KNOWN', value: '+12025550123' },
      destination: { kind: 'UNKNOWN', value: null },
      companyLine: null,
      extension: 'TEST',
      queue: null,
      occurredAt: new Date().toISOString(),
      sequence: null,
      terminalForCall: kind === 'ENDED',
      endReason: kind === 'ENDED' ? 'COMPLETED' : null,
      recordingReference:
        kind === 'RECORDING_READY' ? 'synthetic-no-audio' : null,
    };
    const result = await this.receive(event);
    return { ...result, rootId: callId, synthetic: true };
  }
  routeReview(
    actor: AuthenticatedActor,
    id: string,
    userId: string,
    version: number,
  ) {
    this.admin(actor);
    return this.domain.routeReview(actor, id, userId, version);
  }
  reconcile() {
    return { supported: false as const };
  }
}
