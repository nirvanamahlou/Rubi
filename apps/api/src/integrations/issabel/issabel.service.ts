import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
  HttpException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedActor } from '@nora/contracts';
import { DatabaseService } from '../../database/database.service';
import { CallCenterTelephonyService } from '../../customer-affairs/call-center-telephony.service';
import { IamCallCenterDirectory } from '../../iam/iam-call-center-directory';
import { TelephonyIntegrationService } from '../telephony.service';
import { IntegrationRegistryService } from '../integration-registry.service';
import { AmiClient, type AmiMessage } from './ami';
import { issabelOptions, type IssabelOptions } from './config';
import { normalizeIssabelEvent } from './events';
import { nativeEventNames, normalizeNativeQueueEvent } from './native-events';
import { outboundEventNames, normalizeNativeOutbound } from './native-outbound';
import {
  companyInboundEvents,
  normalizeCompanyInbound,
} from './company-inbound';
import { AmiContinuity } from './continuity';
import { queueWrapupPolicy } from './queue-snapshot';
import { fallback } from './sticky-sales';
import { StickyPreviewBudget } from './sticky-preview';

@Injectable()
export class IssabelService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IssabelService.name);
  private client?: AmiClient;
  private options: IssabelOptions | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private nextConnect = 0;
  private failures = 0;
  private queuedEvents = 0;
  private eventTail: Promise<void> = Promise.resolve();
  private stopped = false;
  private state = 'DISABLED';
  private gap = false;
  private continuity?: AmiContinuity;
  private running?: Promise<void>;
  private shutdownDeadline = Infinity;
  private readonly stickyPreviewBudget = new StickyPreviewBudget();
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(CallCenterTelephonyService)
    private readonly domain: CallCenterTelephonyService,
    @Inject(IamCallCenterDirectory)
    private readonly directory: IamCallCenterDirectory,
    @Inject(TelephonyIntegrationService)
    private readonly events: TelephonyIntegrationService,
    @Inject(IntegrationRegistryService)
    private readonly registry: IntegrationRegistryService,
  ) {}
  /** Server-only dry decision; never connected to a controller or PBX dial action. */
  async previewPreviousAgent(
    actor: AuthenticatedActor,
    queue: string,
    phone: string,
  ) {
    const options = this.options;
    if (!options) throw new ForbiddenException();
    return this.stickyPreviewBudget.run(queue, async (signal) => {
      // Reuse Integrations' branch/permission/connection checks before querying AMI.
      await this.events.preferredAgent(
        actor,
        options.connectionId,
        queue,
        phone,
        null,
      );
      if (signal.aborted) return fallback(queue, 'LOOKUP_TIMEOUT');
      const wrapup = queueWrapupPolicy(
        this.config.get<string>('ISSABEL_STICKY_QUEUE_WRAPUP_SECONDS_JSON'),
        queue,
      );
      if (wrapup === null) return fallback(queue, 'QUEUE_POLICY_UNVERIFIED');
      const client = this.client;
      if (!client?.connected || this.stopped)
        return fallback(queue, 'AVAILABILITY_UNKNOWN');
      const snapshot = await client.queueSnapshot(queue, wrapup);
      if (signal.aborted) return fallback(queue, 'LOOKUP_TIMEOUT');
      if (client !== this.client || !client.connected)
        return fallback(queue, 'AVAILABILITY_UNKNOWN');
      const decision = await this.events.preferredAgent(
        actor,
        options.connectionId,
        queue,
        phone,
        snapshot,
      );
      if (signal.aborted) return fallback(queue, 'LOOKUP_TIMEOUT');
      if (this.stopped || client !== this.client || !client.connected)
        return fallback(queue, 'AVAILABILITY_UNKNOWN');
      return decision;
    });
  }
  onModuleInit() {
    try {
      this.options = issabelOptions(this.config);
    } catch {
      this.state = 'CONFIGURATION_ERROR';
      this.logger.error('Issabel configuration rejected.');
      return;
    }
    if (!this.options) return;
    this.continuity = new AmiContinuity(this.db, this.options.connectionId);
    this.state = 'NOT_CONNECTED';
    this.timer = setInterval(() => {
      this.runTick();
    }, 2000);
    this.timer.unref();
    this.runTick();
  }
  private runTick() {
    if (!this.busy && !this.stopped) this.running = this.tick();
  }
  async onModuleDestroy() {
    this.stopped = true;
    this.shutdownDeadline = Date.now() + 30000;
    clearInterval(this.timer);
    this.client?.close();
    await this.running;
    // Frames received before shutdown are still committed through normal ingress.
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const drained = await Promise.race([
      this.eventTail.then(() => true),
      new Promise<boolean>((resolve) => {
        timeout = setTimeout(() => resolve(false), 30000);
      }),
    ]);
    clearTimeout(timeout);
    if (!drained) {
      this.gap = true;
      await this.continuity?.gap('SHUTDOWN_TIMEOUT').catch(() => {
        this.logger.warn('Issabel continuity audit unavailable.');
      });
    }
    await this.continuity?.stop().catch(() => {
      this.logger.warn('Issabel continuity audit unavailable.');
    });
    this.state = 'DISABLED';
  }
  private markGap(reason: 'DISCONNECTED' | 'BUFFER_LIMIT' | 'INGRESS_FAILED') {
    this.gap = true;
    void this.continuity?.gap(reason).catch(() => {
      this.logger.warn('Issabel continuity audit unavailable.');
    });
  }
  private async connection() {
    const options = this.options ?? issabelOptions(this.config);
    if (!options) throw new ForbiddenException('Issabel is disabled.');
    const row = await this.db.client.integrationTelephonyConnection.findUnique({
      where: { id: options.connectionId },
    });
    if (!row || row.synthetic || !row.active)
      throw new ForbiddenException('Issabel connection is inactive.');
    return row;
  }
  async status(actor: AuthenticatedActor) {
    this.domain.authorize(actor);
    const options = this.options;
    const connection = options
      ? await this.db.client.integrationTelephonyConnection.findFirst({
          where: {
            id: options.connectionId,
            branchId: { in: [...actor.branchIds] },
            synthetic: false,
          },
          select: { id: true, active: true, branchId: true },
        })
      : null;
    const continuity = connection
      ? await new AmiContinuity(this.db, connection.id).snapshot()
      : null;
    return {
      provider: 'ISSABEL',
      state: connection ? this.state : 'NOT_CONFIGURED',
      connectionId: connection?.id ?? null,
      branchId: connection?.branchId ?? null,
      eventCoverage: !connection
        ? 'NOT_CONFIGURED'
        : this.gap || continuity?.reconciliationRequired
          ? 'GAP'
          : 'LIVE_ONLY',
      continuity,
      popupDeliveryEnabled: !!connection?.active && !options?.nativeCapture,
      pendingFrames: connection ? this.queuedEvents : null,
      reconciliationSupported: false,
      outboundAvailable:
        !!connection?.active &&
        !!this.client?.connected &&
        !options?.nativeCapture,
    };
  }
  async activate(
    actor: AuthenticatedActor,
    id: string,
    version: number,
    active: boolean,
  ) {
    this.domain.authorize(actor);
    if (!this.registry.canManage(actor)) throw new ForbiddenException();
    const options = issabelOptions(this.config);
    if (!options || options.connectionId !== id)
      throw new BadRequestException(
        'Configure the private Issabel environment first.',
      );
    await this.db.client.$transaction(async (tx) => {
      const row = await tx.integrationTelephonyConnection.updateMany({
        where: {
          id,
          version,
          synthetic: false,
          branchId: { in: [...actor.branchIds] },
        },
        data: { active, version: { increment: 1 } },
      });
      if (row.count !== 1) throw new ConflictException();
      await tx.integrationTelephonyAudit.create({
        data: {
          connectionId: id,
          actorUserId: actor.userId,
          entityId: id,
          action: active ? 'ISSABEL_ENABLED' : 'ISSABEL_DISABLED',
          metadata: {},
        },
      });
    });
    this.client?.close();
    this.nextConnect = 0;
    return { ok: true };
  }
  async originate(
    actor: AuthenticatedActor,
    input: { id: string; connectionId: string; number: string },
  ) {
    this.domain.authorize(actor, true);
    if (
      !(await this.directory.canOriginate(
        (await this.connection()).branchId,
        actor.userId,
      ))
    )
      throw new ForbiddenException();
    if (
      !actor.permissions.includes('customer_affairs.call_center.calls.create')
    )
      throw new ForbiddenException();
    const connection = await this.connection();
    const options = this.options ?? issabelOptions(this.config)!;
    if (options.nativeCapture)
      throw new ForbiddenException(
        'Native capture does not allow outbound commands.',
      );
    if (
      input.connectionId !== connection.id ||
      !actor.branchIds.includes(connection.branchId)
    )
      throw new ForbiddenException();
    if (
      !/^\+?\d{7,15}$/.test(input.number) ||
      !options.prefixes.some((p) => input.number.startsWith(p))
    )
      throw new BadRequestException(
        'Destination is outside the approved dial prefixes.',
      );
    const fingerprint = this.domain.crypto.fingerprint(
      JSON.stringify({
        actor: actor.userId,
        connection: connection.id,
        number: input.number,
      }),
    );
    return this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${'issabel:command:' + input.id},0))`;
      const prior = await tx.integrationTelephonyCommand.findUnique({
        where: { id: input.id },
      });
      if (prior) {
        if (
          prior.actorUserId !== actor.userId ||
          prior.fingerprint !== fingerprint
        )
          throw new ConflictException();
        return { id: prior.id, state: prior.state };
      }
      await this.directory.resolve(tx, connection.branchId, actor.userId);
      const mappings = await tx.integrationTelephonyMapping.findMany({
        where: {
          connectionId: connection.id,
          userId: actor.userId,
          active: true,
        },
        take: 2,
      });
      if (mappings.length !== 1 || !/^\d{2,10}$/.test(mappings[0]!.extension))
        throw new BadRequestException(
          'Exactly one authorized extension is required.',
        );
      if (
        !(await this.directory.eligibleMapping(
          connection.branchId,
          actor.userId,
          mappings[0]!.teamId,
          tx,
        ))
      )
        throw new ForbiddenException();
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${'issabel:rate:' + actor.userId},0))`;
      if (
        (await tx.integrationTelephonyCommand.count({
          where: {
            actorUserId: actor.userId,
            createdAt: { gte: new Date(Date.now() - 60000) },
          },
        })) >= 3
      )
        throw new BadRequestException('Outbound rate limit exceeded.');
      const row = await tx.integrationTelephonyCommand.create({
        data: {
          id: input.id,
          connectionId: connection.id,
          actorUserId: actor.userId,
          extension: mappings[0]!.extension,
          fingerprint,
          keyVersion: this.domain.crypto.keyVersion,
          encryptedDestination: this.domain.crypto.encrypt(
            input.number,
            `issabel:command:${input.id}`,
          ),
        },
      });
      await tx.integrationTelephonyAudit.create({
        data: {
          connectionId: connection.id,
          actorUserId: actor.userId,
          entityId: row.id,
          action: 'ORIGINATE_QUEUED',
          metadata: {},
        },
      });
      return { id: row.id, state: row.state };
    });
  }
  async command(actor: AuthenticatedActor, id: string) {
    this.domain.authorize(actor);
    const row = await this.db.client.integrationTelephonyCommand.findFirst({
      where: {
        id,
        actorUserId: actor.userId,
        connection: { branchId: { in: [...actor.branchIds] } },
      },
      select: { id: true, state: true, createdAt: true, updatedAt: true },
    });
    if (!row) throw new NotFoundException();
    return row;
  }
  private async incoming(message: AmiMessage, receivedAt = new Date()) {
    const connection = await this.connection();
    if (this.options?.nativeCapture) {
      const outbound = await normalizeNativeOutbound(
        connection.id,
        message,
        this.options.companyCapture
          ? this.options.companyExtensions
          : this.options.outboundExtensions,
        this.options.outboundPeers,
        (id) => this.events.acceptedEvent(connection.id, id),
        receivedAt,
      );
      if (outbound) {
        await this.events.receive(outbound, 'ISSABEL');
        return;
      }
      if (this.options.companyCapture) {
        const inbound = await normalizeCompanyInbound(
          connection.id,
          message,
          this.options.inboundPeers,
          this.options.companyExtensions,
          (id) => this.events.acceptedEvent(connection.id, id),
          receivedAt,
        );
        if (inbound) await this.events.receive(inbound, 'ISSABEL');
        return;
      }
      const event = await normalizeNativeQueueEvent(
        connection.id,
        message,
        this.options.inboundQueues,
        (id) => this.events.acceptedEvent(connection.id, id),
        receivedAt,
      );
      if (event) await this.events.receive(event, 'ISSABEL');
      return;
    }
    const actionId = message.actionid;
    if (
      message.event === 'OriginateResponse' &&
      actionId &&
      /^[0-9a-f-]{36}$/i.test(actionId)
    ) {
      if (!['Success', 'Failure'].includes(message.response ?? ''))
        throw Error('ISSABEL_INVALID_RESULT');
      await this.db.client.$transaction(async (tx) => {
        const row = await tx.integrationTelephonyCommand.findFirst({
          where: {
            id: actionId,
            connectionId: connection.id,
            state: { in: ['DISPATCHING', 'ACCEPTED', 'UNKNOWN'] },
          },
        });
        if (!row) return;
        const state = message.response === 'Success' ? 'SUCCEEDED' : 'FAILED';
        const changed = await tx.integrationTelephonyCommand.updateMany({
          where: {
            id: row.id,
            state: { in: ['DISPATCHING', 'ACCEPTED', 'UNKNOWN'] },
          },
          data: { state },
        });
        if (changed.count)
          await tx.integrationTelephonyAudit.create({
            data: {
              connectionId: connection.id,
              actorUserId: row.actorUserId,
              entityId: row.id,
              action: 'ORIGINATE_RESULT',
              metadata: { state },
            },
          });
      });
    }
    const event = normalizeIssabelEvent(connection.id, message);
    if (event) await this.events.receive(event, 'ISSABEL');
  }
  private async dispatch() {
    const options = this.options!,
      client = this.client!;
    // A crashed/uncertain send is never retried, even after reconnect or process restart.
    await this.db.client.integrationTelephonyCommand.updateMany({
      where: {
        connectionId: options.connectionId,
        state: { in: ['DISPATCHING', 'ACCEPTED'] },
        updatedAt: { lt: new Date(Date.now() - 60000) },
      },
      data: { state: 'UNKNOWN' },
    });
    const rows = await this.db.client.integrationTelephonyCommand.findMany({
      where: { connectionId: options.connectionId, state: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
      take: 5,
    });
    for (const row of rows) {
      let allowed = row.createdAt > new Date(Date.now() - 60000);
      if (allowed) {
        const c = await this.connection();
        const mapping =
          await this.db.client.integrationTelephonyMapping.findFirst({
            where: {
              connectionId: c.id,
              userId: row.actorUserId,
              extension: row.extension,
              active: true,
            },
          });
        allowed =
          !!mapping &&
          (await this.directory.eligibleMapping(
            c.branchId,
            row.actorUserId,
            mapping.teamId,
          )) &&
          (await this.directory.canOriginate(c.branchId, row.actorUserId));
      }
      const claim = await this.db.client.integrationTelephonyCommand.updateMany(
        {
          where: { id: row.id, state: 'QUEUED' },
          data: {
            state: allowed ? 'DISPATCHING' : 'EXPIRED',
            dispatchedAt: allowed ? new Date() : null,
          },
        },
      );
      if (!claim.count || !allowed) continue;
      let state = 'UNKNOWN';
      try {
        const number = this.domain.crypto.decrypt<string>(
          row.encryptedDestination,
          row.keyVersion,
          `issabel:command:${row.id}`,
        );
        if (!options.prefixes.some((p) => number.startsWith(p)))
          state = 'FAILED';
        else {
          await client.originate(
            row.id,
            row.extension,
            number,
            options.context,
            options.technology,
          );
          state = 'ACCEPTED';
        }
      } catch (error) {
        state =
          error instanceof Error && error.message === 'AMI_ACTION_REJECTED'
            ? 'FAILED'
            : 'UNKNOWN';
      }
      // An asynchronous OriginateResponse may have settled the command first.
      await this.db.client.$transaction(async (tx) => {
        await tx.integrationTelephonyCommand.updateMany({
          where: { id: row.id, state: 'DISPATCHING' },
          data: { state },
        });
        await tx.integrationTelephonyAudit.create({
          data: {
            connectionId: row.connectionId,
            actorUserId: row.actorUserId,
            entityId: row.id,
            action: 'ORIGINATE_DISPATCH',
            metadata: { state },
          },
        });
      });
    }
  }
  private async receiveWithRetry(message: AmiMessage, receivedAt: Date) {
    for (let attempt = 0; ; attempt++) {
      if (Date.now() >= this.shutdownDeadline)
        throw Error('ISSABEL_DRAIN_EXPIRED');
      try {
        await this.incoming(message, receivedAt);
        return;
      } catch (error) {
        const permanent =
          (error instanceof Error &&
            error.message === 'NATIVE_TIMESTAMP_INVALID') ||
          (error instanceof HttpException &&
            error.getStatus() < 500 &&
            error.getStatus() !== 429);
        if (permanent || attempt >= 5) throw error;
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.min(10000, 500 * 2 ** attempt) +
              Math.floor(Math.random() * 250),
          ),
        );
      }
    }
  }
  private async tick() {
    if (this.busy || this.stopped || !this.options) return;
    this.busy = true;
    try {
      await this.connection();
      await this.continuity?.start();
      if (this.stopped) return;
      if (!this.client?.connected) {
        if (Date.now() < this.nextConnect) return;
        const client = new AmiClient();
        this.client = client;
        client.on('disconnected', () => {
          this.state = 'NOT_CONNECTED';
          if (!this.stopped) this.markGap('DISCONNECTED');
        });
        client.on('event', (message: AmiMessage) => {
          if (this.stopped) return;
          if (
            this.options?.nativeCapture
              ? !nativeEventNames.has(message.event ?? '') &&
                !outboundEventNames.has(message.event ?? '') &&
                !(
                  this.options.companyCapture &&
                  companyInboundEvents.has(message.event ?? '')
                )
              : message.event !== 'UserEvent' &&
                message.event !== 'OriginateResponse'
          )
            return;
          const receivedAt = new Date();
          if (++this.queuedEvents > 500) {
            this.queuedEvents--;
            this.markGap('BUFFER_LIMIT');
            client.close();
            return;
          }
          this.eventTail = this.eventTail
            .then(() => this.receiveWithRetry(message, receivedAt))
            .catch(() => {
              this.markGap('INGRESS_FAILED');
              this.logger.warn(
                'Issabel event rejected or could not be persisted.',
              );
            })
            .finally(() => {
              this.queuedEvents--;
            });
        });
        try {
          await client.connect(this.options);
          if (this.stopped) {
            client.close();
            return;
          }
          await this.continuity?.connected();
        } catch {
          client.close();
          throw Error('ISSABEL_UNAVAILABLE');
        }
        this.failures = 0;
        this.state = 'CONNECTED';
      }
      await this.client.ping();
      if (!this.options.nativeCapture) await this.dispatch();
    } catch {
      this.client?.close();
      this.state = 'NOT_CONNECTED';
      this.nextConnect =
        Date.now() +
        Math.min(60000, 1000 * 2 ** Math.min(++this.failures, 6)) +
        Math.floor(Math.random() * 1000);
    } finally {
      this.busy = false;
    }
  }
}
