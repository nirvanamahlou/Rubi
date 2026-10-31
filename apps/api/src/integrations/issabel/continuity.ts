import type { DatabaseService } from '../../database/database.service';

type Incident =
  'DISCONNECTED' | 'BUFFER_LIMIT' | 'INGRESS_FAILED' | 'SHUTDOWN_TIMEOUT';

/** Append-only, provider-private-data-free operational evidence. Never clears gaps. */
export class AmiContinuity {
  private initialized = false;
  private last = '';
  private tail: Promise<void> = Promise.resolve();
  constructor(
    private readonly db: DatabaseService,
    private readonly connectionId: string,
  ) {}

  private record(action: string, reason: string) {
    const key = `${action}:${reason}`;
    const write = this.tail.then(async () => {
      if (this.last === key) return;
      await this.db.client.integrationTelephonyAudit.create({
        data: {
          connectionId: this.connectionId,
          entityId: this.connectionId,
          action,
          metadata: { reason },
        },
      });
      this.last = key;
    });
    // A failed audit must not poison all subsequent writes; callers observe failure.
    this.tail = write.catch(() => {});
    return write;
  }

  async start() {
    if (this.initialized) return;
    const prior = await this.db.client.integrationTelephonyAudit.findFirst({
      where: { connectionId: this.connectionId, action: 'AMI_START' },
      select: { id: true },
    });
    const legacyReceipt = !prior
      ? await this.db.client.integrationTelephonyInbox.findFirst({
          where: { connectionId: this.connectionId },
          select: { id: true },
        })
      : null;
    // A graceful stop also leaves an unobserved interval until the next connection.
    if (prior) await this.record('AMI_GAP', 'PROCESS_RESTART');
    else if (legacyReceipt)
      await this.record('AMI_GAP', 'LEGACY_COLLECTOR_RESTART');
    await this.record('AMI_START', 'COLLECTOR_STARTED');
    this.initialized = true;
  }

  connected() {
    return this.record('AMI_CONNECTED', 'AUTHENTICATED');
  }
  gap(reason: Incident) {
    return this.record('AMI_GAP', reason);
  }
  async stop() {
    if (this.initialized) await this.record('AMI_STOPPED', 'COLLECTOR_STOPPED');
  }
  async snapshot() {
    const [latest, gap] = await Promise.all([
      this.db.client.integrationTelephonyAudit.findFirst({
        where: {
          connectionId: this.connectionId,
          action: {
            in: ['AMI_START', 'AMI_CONNECTED', 'AMI_GAP', 'AMI_STOPPED'],
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { action: true, createdAt: true },
      }),
      this.db.client.integrationTelephonyAudit.findFirst({
        where: { connectionId: this.connectionId, action: 'AMI_GAP' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { createdAt: true },
      }),
    ]);
    return {
      lastTransition: latest?.action ?? null,
      lastTransitionAt: latest?.createdAt.toISOString() ?? null,
      lastGapAt: gap?.createdAt.toISOString() ?? null,
      reconciliationRequired: !!gap,
    };
  }
}
