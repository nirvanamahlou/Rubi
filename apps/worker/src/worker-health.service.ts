import {
  Injectable,
  Inject,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseRedisUrl } from '@rubi/config';
import { createHealthData, type HealthData } from '@rubi/contracts';
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

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    this.queue = undefined;
  }
}
