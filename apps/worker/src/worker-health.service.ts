import {
  Injectable,
  Inject,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseRedisUrl } from '@nora/config';
import {
  createHealthData,
  type HealthData,
  type WorkerHealthResponseV1,
} from '@nora/contracts';
import { Queue } from 'bullmq';

@Injectable()
export class WorkerHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerHealthService.name);
  private queue: Queue | undefined;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const queueName = this.config.getOrThrow<string>('WORKER_QUEUE_NAME');
    const connection = parseRedisUrl(
      this.config.getOrThrow<string>('REDIS_URL'),
    );

    this.queue = new Queue(queueName, { connection });
    await this.queue.waitUntilReady();
    await this.queue.getJobCounts('wait', 'active', 'failed');

    this.logger.log(`Redis and BullMQ queue "${queueName}" are ready.`);
  }

  getHealth(now: Date = new Date()): HealthData {
    if (!this.queue) {
      throw new Error('Worker queue has not been initialized.');
    }

    return createHealthData('worker', now);
  }

  /**
   * Verifies the actual Redis connection and the configured BullMQ queue.
   * The response is intentionally operationally narrow: callers get no
   * credential, host, queue-name, or job payload information.
   */
  async probe(now: Date = new Date()): Promise<WorkerHealthResponseV1> {
    const checkedAt = now.toISOString();
    const unavailable = (
      component: 'QUEUE' | 'REDIS' | 'WORKER',
      detail: string,
    ): WorkerHealthResponseV1['components'][number] => ({
      component,
      status: 'UNAVAILABLE',
      checkedAt,
      latencyMs: null,
      detail,
    });
    if (!this.queue) {
      return {
        data: createHealthData('worker', now),
        components: [
          unavailable('WORKER', 'Worker هنوز Queue را راه‌اندازی نکرده است.'),
          unavailable('REDIS', 'اتصال Redis در Worker آماده نیست.'),
          unavailable('QUEUE', 'Queue در Worker آماده نیست.'),
        ],
      };
    }

    const redisStarted = performance.now();
    try {
      await this.queue.waitUntilReady();
    } catch {
      return {
        data: createHealthData('worker', now),
        components: [
          unavailable(
            'WORKER',
            'Worker فعال است اما وابستگی صف در دسترس نیست.',
          ),
          unavailable('REDIS', 'Redis از مسیر پیکربندی‌شده پاسخ نداد.'),
          unavailable('QUEUE', 'به‌علت نبود Redis، Queue بررسی نشد.'),
        ],
      };
    }

    const redis: WorkerHealthResponseV1['components'][number] = {
      component: 'REDIS',
      status: 'HEALTHY',
      checkedAt,
      latencyMs: Math.round(performance.now() - redisStarted),
      detail: 'اتصال Redis توسط Worker تأیید شد.',
    };
    const queueStarted = performance.now();
    try {
      await this.queue.getJobCounts('wait', 'active', 'failed');
      return {
        data: this.getHealth(now),
        components: [
          {
            component: 'WORKER',
            status: 'HEALTHY',
            checkedAt,
            latencyMs: 0,
            detail: 'Worker در حال اجرا است.',
          },
          redis,
          {
            component: 'QUEUE',
            status: 'HEALTHY',
            checkedAt,
            latencyMs: Math.round(performance.now() - queueStarted),
            detail: 'Queue BullMQ با یک بررسی فقط‌خواندنی پاسخ داد.',
          },
        ],
      };
    } catch {
      return {
        data: this.getHealth(now),
        components: [
          {
            component: 'WORKER',
            status: 'HEALTHY',
            checkedAt,
            latencyMs: 0,
            detail: 'Worker در حال اجرا است.',
          },
          redis,
          unavailable('QUEUE', 'Queue BullMQ در بررسی فعلی پاسخ نداد.'),
        ],
      };
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    this.queue = undefined;
  }
}
