import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  HttpException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { AuthenticatedActor } from '@nora/contracts';
import { recordingRange } from './recording-range';
import { DatabaseService } from '../../database/database.service';
import { CallCenterTelephonyService } from '../../customer-affairs/call-center-telephony.service';
import { TelephonyIntegrationService } from '../telephony.service';

export const RECORDING_CHUNK_BYTES = 32768;
export interface RecordingStart {
  id: string;
  rootCallId: string;
  externalCallId: string;
  direction: 'IN' | 'OUT';
  sha256: string;
  sizeBytes: number;
}
@Injectable()
export class IssabelRecordingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IssabelRecordingsService.name);
  private timer?: ReturnType<typeof setInterval>;
  private maintaining = false;
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(CallCenterTelephonyService)
    private readonly domain: CallCenterTelephonyService,
    @Inject(TelephonyIntegrationService)
    private readonly events: TelephonyIntegrationService,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.maintain().catch(() => {
        this.logger.warn('Issabel recording expiry could not complete.');
      });
    }, 60000);
    this.timer.unref();
  }
  async maintain() {
    if (this.maintaining) return;
    this.maintaining = true;
    try {
      await this.prune();
      if (this.config.get<string>('ISSABEL_ENABLED') !== 'true') return;
      const { connectionId } = await this.policy();
      // Existing audit is the durable publication receipt. A crash between inbox
      // commit and this receipt is safe: receive() deduplicates the same identity.
      const rows = await this.db.client.$queryRaw<Array<{ id: string }>>`
        SELECT r.id FROM integration_telephony_recordings r
        WHERE r."connectionId"=${connectionId}::uuid AND r.state='COMPLETE'
          AND r."expiresAt">now() AND NOT EXISTS (
            SELECT 1 FROM integration_telephony_audit a
            WHERE a."connectionId"=r."connectionId" AND a."entityId"=r.id
              AND a.action='RECORDING_PUBLISHED')
        ORDER BY r."completedAt",r.id LIMIT 20`;
      for (const row of rows) {
        try {
          await this.finish(row.id);
        } catch {
          this.logger.warn(
            'Recording publication pending; durable audio retained.',
          );
        }
      }
    } finally {
      this.maintaining = false;
    }
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }
  private async policy() {
    const connectionId = this.config.get<string>('ISSABEL_CONNECTION_ID');
    const days = Number(
      this.config.get<string>('ISSABEL_RECORDING_RETENTION_DAYS'),
    );
    if (
      this.config.get<string>('ISSABEL_ENABLED') !== 'true' ||
      !connectionId ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > 365
    )
      throw new ForbiddenException('Recording retention is not configured.');
    const connection =
      await this.db.client.integrationTelephonyConnection.findUnique({
        where: { id: connectionId },
      });
    if (!connection?.active || connection.synthetic)
      throw new ForbiddenException();
    return { connectionId, days };
  }
  async start(input: RecordingStart) {
    const { connectionId, days } = await this.policy();
    const crypto = this.domain.crypto;
    const metadata = {
      rootCallId: input.rootCallId,
      externalCallId: input.externalCallId,
      direction: input.direction,
    };
    const rootFingerprint = crypto.fingerprint(
      `telephony:root:${connectionId}:${input.rootCallId}`,
    );
    return this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${'issabel:recordings:' + connectionId},0))`;
      const existing = await tx.integrationTelephonyRecording.findUnique({
        where: { id: input.id },
      });
      if (existing) {
        if (
          existing.connectionId !== connectionId ||
          existing.rootFingerprint !== rootFingerprint ||
          existing.sha256 !== input.sha256 ||
          existing.sizeBytes !== input.sizeBytes ||
          JSON.stringify(
            crypto.decrypt(
              existing.encryptedMetadata,
              existing.keyVersion,
              `issabel:recording:${input.id}`,
            ),
          ) !== JSON.stringify(metadata)
        )
          throw new ConflictException();
        return { id: existing.id, state: existing.state };
      }
      if (
        await tx.integrationTelephonyAudit.findFirst({
          where: {
            connectionId,
            entityId: input.id,
            action: 'RECORDING_EXPIRED',
          },
          select: { id: true },
        })
      )
        throw new ConflictException('Recording retention has expired.');
      const day = new Date(Date.now() - 86400000);
      const count = await tx.integrationTelephonyRecording.count({
        where: { connectionId, createdAt: { gte: day } },
      });
      const pending = await tx.integrationTelephonyRecording.count({
        where: { connectionId, state: 'UPLOADING' },
      });
      if (count >= 1000 || pending >= 10)
        throw new BadRequestException('Recording upload quota exceeded.');
      const row = await tx.integrationTelephonyRecording.create({
        data: {
          id: input.id,
          connectionId,
          rootFingerprint,
          sha256: input.sha256,
          sizeBytes: input.sizeBytes,
          encryptedMetadata: crypto.encrypt(
            metadata,
            `issabel:recording:${input.id}`,
          ),
          keyVersion: crypto.keyVersion,
          expiresAt: new Date(Date.now() + days * 86400000),
        },
      });
      return { id: row.id, state: row.state };
    });
  }
  async chunk(id: string, index: number, encoded: string) {
    const { connectionId } = await this.policy();
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= 640 ||
      encoded.length > 43692 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        encoded,
      )
    )
      throw new BadRequestException('Invalid audio chunk.');
    const bytes = Buffer.from(encoded, 'base64');
    if (
      !bytes.length ||
      bytes.length > RECORDING_CHUNK_BYTES ||
      bytes.toString('base64') !== encoded
    )
      throw new BadRequestException('Invalid audio encoding.');
    return this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM integration_telephony_recordings WHERE id=${id}::uuid FOR UPDATE`;
      const row = await tx.integrationTelephonyRecording.findUnique({
        where: { id },
      });
      if (
        !row ||
        row.connectionId !== connectionId ||
        row.expiresAt <= new Date()
      )
        throw new NotFoundException();
      const expected = Math.min(
        RECORDING_CHUNK_BYTES,
        row.sizeBytes - index * RECORDING_CHUNK_BYTES,
      );
      if (expected !== bytes.length)
        throw new BadRequestException('Unexpected audio chunk size.');
      const fingerprint = this.domain.crypto.fingerprint(encoded);
      const prior = await tx.integrationTelephonyRecordingChunk.findUnique({
        where: { recordingId_index: { recordingId: id, index } },
      });
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new ConflictException();
        return { ok: true, duplicate: true };
      }
      if (row.state !== 'UPLOADING') throw new ConflictException();
      await tx.integrationTelephonyRecordingChunk.create({
        data: {
          recordingId: id,
          index,
          fingerprint,
          keyVersion: this.domain.crypto.keyVersion,
          encryptedAudio: this.domain.crypto.encrypt(
            encoded,
            `issabel:audio:${id}:${index}`,
          ),
        },
      });
      return { ok: true, duplicate: false };
    });
  }
  async finish(id: string) {
    const { connectionId } = await this.policy();
    const crypto = this.domain.crypto;
    const row = await this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM integration_telephony_recordings WHERE id=${id}::uuid FOR UPDATE`;
      const recording = await tx.integrationTelephonyRecording.findUnique({
        where: { id },
        include: { chunks: { orderBy: { index: 'asc' } } },
      });
      if (
        !recording ||
        recording.connectionId !== connectionId ||
        recording.expiresAt <= new Date()
      )
        throw new NotFoundException();
      if (recording.state === 'COMPLETE') return recording;
      if (
        recording.chunks.length !==
        Math.ceil(recording.sizeBytes / RECORDING_CHUNK_BYTES)
      )
        throw new BadRequestException('Recording is incomplete.');
      const audio = Buffer.concat(
        recording.chunks.map((chunk, index) => {
          if (index !== chunk.index) throw new BadRequestException();
          return Buffer.from(
            crypto.decrypt<string>(
              chunk.encryptedAudio,
              chunk.keyVersion,
              `issabel:audio:${id}:${index}`,
            ),
            'base64',
          );
        }),
      );
      if (
        audio.length !== recording.sizeBytes ||
        createHash('sha256').update(audio).digest('hex') !== recording.sha256 ||
        audio.toString('ascii', 0, 4) !== 'RIFF' ||
        audio.toString('ascii', 8, 12) !== 'WAVE' ||
        audio.readUInt32LE(4) + 8 !== audio.length
      )
        throw new BadRequestException(
          'Recording checksum or WAV container is invalid.',
        );
      await tx.integrationTelephonyAudit.create({
        data: {
          connectionId,
          entityId: id,
          action: 'RECORDING_STORED',
          metadata: { sizeBytes: audio.length },
        },
      });
      return tx.integrationTelephonyRecording.update({
        where: { id },
        data: { state: 'COMPLETE', completedAt: new Date() },
      });
    });
    const metadata = crypto.decrypt<{
      rootCallId: string;
      externalCallId: string;
      direction: 'IN' | 'OUT';
    }>(row.encryptedMetadata, row.keyVersion, `issabel:recording:${id}`);
    // Publication is idempotent and can be retried independently after a database commit.
    await this.events.receive(
      {
        schemaVersion: 1,
        connectionId,
        externalEventId: `recording:${id}`,
        externalCallId: metadata.externalCallId,
        rootCallId: metadata.rootCallId,
        legId: metadata.externalCallId,
        kind: 'RECORDING_READY',
        direction: metadata.direction,
        caller: { kind: 'UNKNOWN', value: null },
        destination: { kind: 'UNKNOWN', value: null },
        companyLine: null,
        extension: null,
        queue: null,
        occurredAt: row.completedAt!.toISOString(),
        sequence: null,
        terminalForCall: false,
        endReason: null,
        recordingReference: `issabel-recording:${id}`,
      },
      'ISSABEL',
    );
    await this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM integration_telephony_recordings WHERE id=${id}::uuid FOR UPDATE`;
      if (
        !(await tx.integrationTelephonyAudit.findFirst({
          where: { connectionId, entityId: id, action: 'RECORDING_PUBLISHED' },
          select: { id: true },
        }))
      )
        await tx.integrationTelephonyAudit.create({
          data: {
            connectionId,
            entityId: id,
            action: 'RECORDING_PUBLISHED',
            metadata: {},
          },
        });
    });
    return { id, state: 'COMPLETE', sizeBytes: row.sizeBytes };
  }
  async forCall(actor: AuthenticatedActor, callId: string) {
    const context = await this.domain.callRecordingContext(actor, callId);
    if (!context) return { data: [] };
    const ids = context.references.flatMap((reference) => {
      const match = /^issabel-recording:([0-9a-f-]{36})$/i.exec(reference);
      return match ? [match[1]!] : [];
    });
    const rows = await this.db.client.integrationTelephonyRecording.findMany({
      where: {
        id: { in: ids },
        connectionId: context.connectionId,
        rootFingerprint: context.rootFingerprint,
        state: 'COMPLETE',
        expiresAt: { gt: new Date() },
        connection: { branchId: { in: [...actor.branchIds] } },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, sizeBytes: true },
    });
    return { data: rows };
  }
  async read(
    actor: AuthenticatedActor,
    id: string,
    range?: string,
    callId?: string,
  ) {
    if (!callId) this.domain.authorize(actor);
    if (
      !actor.permissions.includes(
        'customer_affairs.call_center.recordings.read',
      )
    )
      throw new ForbiddenException();
    return this.db.client.$transaction(
      async (tx) => {
        const row = await tx.integrationTelephonyRecording.findFirst({
          where: {
            id,
            state: 'COMPLETE',
            expiresAt: { gt: new Date() },
            connection: { branchId: { in: [...actor.branchIds] } },
          },
        });
        if (!row) throw new NotFoundException();
        if (callId) {
          const context = await this.domain.callRecordingContext(
            actor,
            callId,
            tx,
          );
          if (
            !context ||
            context.connectionId !== row.connectionId ||
            context.rootFingerprint !== row.rootFingerprint ||
            !context.references.includes(`issabel-recording:${id}`)
          )
            throw new NotFoundException();
        } else
          await this.domain.authorizeRecording(
            actor,
            row.connectionId,
            row.rootFingerprint,
            `issabel-recording:${id}`,
            tx,
          );
        const bytes = recordingRange(range, row.sizeBytes);
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${'telephony:media-read:' + actor.userId},0))`;
        const recent = await tx.integrationTelephonyAudit.count({
          where: {
            actorUserId: actor.userId,
            action: 'RECORDING_READ',
            createdAt: { gte: new Date(Date.now() - 60000) },
          },
        });
        if (recent >= 60)
          throw new HttpException('Recording read rate exceeded.', 429);
        const first = Math.floor(bytes.start / RECORDING_CHUNK_BYTES);
        const last = Math.floor(bytes.end / RECORDING_CHUNK_BYTES);
        const chunks = await tx.integrationTelephonyRecordingChunk.findMany({
          where: { recordingId: id, index: { gte: first, lte: last } },
          orderBy: { index: 'asc' },
          take: 640,
        });
        if (chunks.length !== last - first + 1)
          throw new ConflictException('Audio integrity failure.');
        const audio = Buffer.concat(
          chunks.map((chunk, offset) => {
            const encoded = this.domain.crypto.decrypt<string>(
              chunk.encryptedAudio,
              chunk.keyVersion,
              `issabel:audio:${id}:${chunk.index}`,
            );
            const data = Buffer.from(encoded, 'base64');
            if (
              chunk.index !== first + offset ||
              this.domain.crypto.fingerprint(encoded) !== chunk.fingerprint ||
              data.length !==
                Math.min(
                  RECORDING_CHUNK_BYTES,
                  row.sizeBytes - chunk.index * RECORDING_CHUNK_BYTES,
                )
            )
              throw new ConflictException('Audio integrity failure.');
            return data;
          }),
        );
        await tx.integrationTelephonyAudit.create({
          data: {
            connectionId: row.connectionId,
            actorUserId: actor.userId,
            entityId: id,
            action: 'RECORDING_READ',
            metadata: { start: bytes.start, end: bytes.end },
          },
        });
        const offset = bytes.start - first * RECORDING_CHUNK_BYTES;
        return {
          ...bytes,
          size: row.sizeBytes,
          audio: audio.subarray(offset, offset + bytes.end - bytes.start + 1),
        };
      },
      // ReadCommitted makes the rate count fresh after the per-actor lock.
      // Concurrent expiry/missing chunks fails closed rather than serving old data.
      { isolationLevel: 'ReadCommitted', timeout: 15000 },
    );
  }
  async prune() {
    const rows = await this.db.client.integrationTelephonyRecording.findMany({
      where: {
        OR: [
          { expiresAt: { lte: new Date() } },
          {
            state: 'UPLOADING',
            createdAt: { lt: new Date(Date.now() - 86400000) },
          },
        ],
      },
      select: { id: true, connectionId: true },
      take: 100,
    });
    if (rows.length)
      await this.db.client.$transaction(async (tx) => {
        for (const row of rows) {
          const removed = await tx.integrationTelephonyRecording.deleteMany({
            where: { id: row.id },
          });
          if (removed.count)
            await tx.integrationTelephonyAudit.create({
              data: {
                connectionId: row.connectionId,
                entityId: row.id,
                action: 'RECORDING_EXPIRED',
                metadata: {},
              },
            });
        }
      });
  }
}
