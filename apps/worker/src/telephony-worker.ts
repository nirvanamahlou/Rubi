import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseRedisUrl } from '@nora/config';
import { Queue, Worker } from 'bullmq';

/** PostgreSQL outbox is authoritative; Redis jobs contain only inbox UUIDs. */
@Injectable()
export class TelephonyWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelephonyWorker.name);
  private queue?: Queue;
  private worker?: Worker;
  private timer?: ReturnType<typeof setInterval>;
  private sweeping = false;
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}
  async request(path: string, method = 'GET') {
    const base = this.config.get<string>('TELEPHONY_API_URL');
    const secret = this.config.get<string>('TELEPHONY_WORKER_SECRET');
    if (!base || !secret || secret.length < 32)
      throw new Error('Telephony worker is not configured.');
    const target = new URL(base);
    if (
      (target.protocol !== 'https:' &&
        !(
          target.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
        )) ||
      target.username ||
      target.password ||
      target.search ||
      target.hash
    )
      throw new Error('Telephony worker requires HTTPS or loopback.');
    const response = await fetch(
      `${base.replace(/\/$/, '')}/internal/telephony-worker/${path}`,
      {
        method,
        redirect: 'error',
        headers: { authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok)
      throw new Error(`Telephony worker transport ${response.status}`);
    return response.json() as Promise<unknown>;
  }
  onModuleInit() {
    if (
      !this.config.get<string>('TELEPHONY_API_URL') ||
      !this.config.get<string>('TELEPHONY_WORKER_SECRET')
    )
      return;
    const connection = parseRedisUrl(
      this.config.getOrThrow<string>('REDIS_URL'),
    );
    const name = `${this.config.getOrThrow<string>('WORKER_QUEUE_NAME')}-telephony-v1`;
    this.queue = new Queue(name, {
      connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 100,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000, jitter: 0.5 },
      },
    });
    this.worker = new Worker(
      name,
      async (job) => {
        await this.request(`${job.data.inboxId as string}/process`, 'POST');
      },
      { connection, concurrency: 4, limiter: { max: 40, duration: 1000 } },
    );
    this.queue.on('error', () =>
      this.logger.warn('Telephony queue unavailable; durable outbox retained.'),
    );
    this.worker.on('error', () =>
      this.logger.warn(
        'Telephony worker unavailable; durable outbox retained.',
      ),
    );
    this.timer = setInterval(() => {
      void this.sweep();
    }, 2000);
    void this.sweep();
  }
  async sweep() {
    if (this.sweeping || !this.queue) return;
    this.sweeping = true;
    try {
      const rows = (await this.request('pending')) as { inboxId: string }[];
      for (const row of rows) {
        const prior = await this.queue.getJob(row.inboxId);
        if (prior && (await prior.getState()) === 'failed') await prior.retry();
        else await this.queue.add('process', row, { jobId: row.inboxId });
      }
    } catch {
      this.logger.warn('Telephony dispatch delayed; next sweep will retry.');
    } finally {
      this.sweeping = false;
    }
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.worker?.close();
    await this.queue?.close();
  }
}
