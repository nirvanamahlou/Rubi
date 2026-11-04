import {
  Inject,
  Injectable,
  Logger,
  Optional,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../database/database.service';
import { TelephonyIntegrationService } from '../telephony.service';
import { CallRecovery, type RecoverySource } from './recovery';
import { DatabaseRecoveryJournal } from './recovery-journal';

export const ISSABEL_RECOVERY_SOURCE = Symbol('ISSABEL_RECOVERY_SOURCE');

/** Disabled until a verified read-only CDR adapter is explicitly supplied.
 * ready() must also verify final organization/access policy and source availability.
 * Polling retries automatically after connectivity returns, independently of AMI.
 */
@Injectable()
export class IssabelRecoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IssabelRecoveryService.name);
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;
  private stopped = false;
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(TelephonyIntegrationService)
    private readonly events: TelephonyIntegrationService,
    @Optional()
    @Inject(ISSABEL_RECOVERY_SOURCE)
    private readonly source?: RecoverySource,
  ) {}
  onModuleInit() {
    const connectionId = this.config.get<string>('ISSABEL_CONNECTION_ID');
    if (
      this.config.get<string>('ISSABEL_RECOVERY_ENABLED') !== 'true' ||
      !this.source ||
      !connectionId
    )
      return;
    const recovery = new CallRecovery(
      connectionId,
      this.source,
      new DatabaseRecoveryJournal(this.db, connectionId),
      (event) => this.events.receiveRecovered(event),
    );
    const tick = async () => {
      let delay = 60000;
      try {
        const active =
          await this.db.client.integrationTelephonyConnection.findFirst({
            where: { id: connectionId, active: true, synthetic: false },
            select: { id: true },
          });
        if (!active) return;
        if ((await recovery.run()) === 'ADVANCED') delay = 1000;
      } catch {
        // No raw source error, private call data or credentials in logs.
        this.logger.warn(
          'Call recovery paused; checkpoint retained for retry.',
        );
      } finally {
        if (!this.stopped) {
          this.timer = setTimeout(() => {
            this.running = tick();
          }, delay);
          this.timer.unref();
        }
      }
    };
    this.running = tick();
  }
  async onModuleDestroy() {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.running;
  }
}
