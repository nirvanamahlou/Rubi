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
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
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
      void this.prune().catch(() => {
        this.logger.warn('Issabel recording expiry could not complete.');
      });
    }, 60000);
    this.timer.unref();
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
    return { id, state: 'COMPLETE', sizeBytes: row.sizeBytes };
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
