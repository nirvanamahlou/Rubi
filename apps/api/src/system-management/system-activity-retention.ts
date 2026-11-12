import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

const HOUR_MS = 60 * 60 * 1000;
const RETENTION_MS = 7 * 24 * HOUR_MS;
const BATCH_SIZE = 1000;

@Injectable()
export class SystemActivityRetention implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SystemActivityRetention.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private stopped = false;

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  onModuleInit() {
    void this.purgeExpired();
    this.timer = setInterval(() => void this.purgeExpired(), HOUR_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    this.stopped = true;
    clearInterval(this.timer);
  }

  async purgeExpired(now = new Date()) {
    if (this.running || this.stopped) return;
    this.running = true;
    const cutoff = new Date(now.getTime() - RETENTION_MS);
    try {
      for (let batch = 0; batch < 10 && !this.stopped; batch++) {
        const deleted = await this.database.client.$executeRaw`
          WITH expired AS (
            SELECT id FROM system_audit_events
            WHERE "createdAt" < ${cutoff}
            ORDER BY "createdAt", id
            LIMIT ${BATCH_SIZE}
            FOR UPDATE SKIP LOCKED
          )
          DELETE FROM system_audit_events AS activity
          USING expired
          WHERE activity.id = expired.id
        `;
        if (deleted < BATCH_SIZE) break;
      }
    } catch {
      this.logger.error('Could not purge expired system activity');
    } finally {
      this.running = false;
    }
  }
}
