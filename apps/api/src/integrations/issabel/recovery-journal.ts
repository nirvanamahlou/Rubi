import type { DatabaseService } from '../../database/database.service';
import type { RecoveryJournal } from './recovery';

/** Integrations-owned append-only checkpoint. No numbers/names/raw CDR in audit. */
export class DatabaseRecoveryJournal implements RecoveryJournal {
  constructor(
    private readonly db: DatabaseService,
    private readonly connectionId: string,
  ) {}

  private transaction<T>(
    operation: (
      state: { start: string; through: string } | null,
      append: (action: string, through: string) => Promise<void>,
    ) => Promise<T>,
  ) {
    return this.db.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${'cdr-recovery:' + this.connectionId},0))`;
      const [row] = await tx.$queryRaw<
        { start: Date | null; through: Date | null }[]
      >`
        SELECT MIN((metadata->>'through')::timestamptz) AS start,
               MAX((metadata->>'through')::timestamptz) AS through
        FROM integration_telephony_audit
        WHERE "connectionId"=${this.connectionId}::uuid
        AND action IN ('CDR_RECOVERY_START','CDR_RECOVERY_CHECKPOINT')`;
      return operation(
        row?.start && row.through
          ? {
              start: row.start.toISOString(),
              through: row.through.toISOString(),
            }
          : null,
        async (action, through) => {
          await tx.integrationTelephonyAudit.create({
            data: {
              connectionId: this.connectionId,
              entityId: this.connectionId,
              action,
              metadata: { through },
            },
          });
        },
      );
    });
  }
  loadOrStart(initialFrom: string) {
    return this.transaction(async (state, append) => {
      if (state) return state;
      await append('CDR_RECOVERY_START', initialFrom);
      return { start: initialFrom, through: initialFrom };
    });
  }
  advance(expectedThrough: string, through: string) {
    return this.transaction(async (state, append) => {
      if (!state || state.through !== expectedThrough) return false;
      if (
        !Number.isFinite(Date.parse(through)) ||
        Date.parse(through) <= Date.parse(state.through)
      )
        throw Error('RECOVERY_INVALID_CHECKPOINT');
      await append('CDR_RECOVERY_CHECKPOINT', through);
      return true;
    });
  }
}
