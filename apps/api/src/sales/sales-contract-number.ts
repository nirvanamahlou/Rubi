import { InternalServerErrorException } from '@nestjs/common';
import type { Prisma } from '@nora/database';

export async function allocateSalesContractNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  // Unlike nextval(), this row update rolls back with the entire contract.
  const [counter] = await tx.$queryRaw<Array<{ value: number }>>`
    UPDATE "sales_contract_number_counters"
    SET "last_number" = "last_number" + 1
    WHERE "id" = 1 AND "last_number" < 999999
    RETURNING "last_number" AS value
  `;
  if (!counter || !/^[0-9]{6}$/.test(String(counter.value)))
    throw new InternalServerErrorException(
      'Sales contract numbering is unavailable or exhausted.',
    );
  return String(counter.value);
}

export async function retrySalesContractCreate<T>(
  create: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await create();
    } catch (error) {
      // PostgreSQL aborts the whole Serializable transaction on contention.
      // Retry only that known rollback, never an uncertain commit or domain error.
      if (attempt >= 4 || !isSerializationAbort(error)) throw error;
    }
  }
}

function isSerializationAbort(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const known = error as {
    code?: unknown;
    meta?: {
      code?: unknown;
      driverAdapterError?: {
        cause?: { originalCode?: unknown; kind?: unknown };
      };
    };
  };
  if (known.code === 'P2034') return true;
  // Raw UPDATE errors can retain SQLSTATE/adapter details under P2010.
  return (
    known.code === 'P2010' &&
    (known.meta?.code === '40001' ||
      known.meta?.driverAdapterError?.cause?.originalCode === '40001' ||
      known.meta?.driverAdapterError?.cause?.kind ===
        'TransactionWriteConflict')
  );
}
