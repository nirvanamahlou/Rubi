import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { readFileSync, statSync } from 'node:fs';

/** Optional operator-approved bootstrap directory; never a user/permission mapping. */
export function privateAnswerDirectory(
  path: string | undefined,
  branchId: string,
  connectionId: string | undefined,
  extension: string,
): { name: string; unit: string }[] {
  if (!path || !connectionId) return [];
  try {
    if (statSync(path).size > 65536) return [];
    const doc = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
    if (
      doc.version !== 1 ||
      doc.branchId !== branchId ||
      doc.connectionId !== connectionId ||
      !Array.isArray(doc.employees) ||
      doc.employees.length > 200
    )
      return [];
    return doc.employees
      .filter(
        (row: { extension?: unknown; name?: unknown; unit?: unknown }) =>
          row &&
          row.extension === extension &&
          typeof row.name === 'string' &&
          row.name.trim().length > 0 &&
          row.name.length <= 160 &&
          typeof row.unit === 'string' &&
          row.unit.length <= 320,
      )
      .slice(0, 20)
      .map((row: { name: string; unit: string }) => ({
        name: row.name.trim(),
        unit: row.unit.trim(),
      }));
  } catch {
    return [];
  }
}

export interface CallAnswerRecipient {
  extension: string;
  label: string;
  shared: boolean;
  answeredAt: string;
}

/** Internal HR projection. The consumer must supply the authenticated call branch. */
@Injectable()
export class HrCallAnswerDirectory {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async resolve(
    branchId: string,
    extension: string,
    answeredAt: string,
    tx?: Prisma.TransactionClient,
    connectionId?: string,
  ): Promise<CallAnswerRecipient> {
    let rows = await (tx ?? this.db.client).hrEmployee.findMany({
      where: {
        branchId,
        deletedAt: null,
        status: 'فعال',
        records: {
          some: {
            branchId,
            section: 'employee',
            tab: 'internalContact',
            deletedAt: null,
            values: { path: ['0'], equals: extension },
          },
        },
      },
      select: { name: true, unit: true },
      orderBy: { personnelCode: 'asc' },
      take: 21,
    });
    // Bootstrap only an entirely empty branch. Never resurrect a removed or
    // inactive employee from the snapshot once HR becomes authoritative.
    if (
      !rows.length &&
      process.env.CALL_CENTER_ANSWER_DIRECTORY_FILE &&
      !(await (tx ?? this.db.client).hrEmployee.count({ where: { branchId } }))
    )
      rows = privateAnswerDirectory(
        process.env.CALL_CENTER_ANSWER_DIRECTORY_FILE,
        branchId,
        connectionId,
        extension,
      );
    // A shared extension is evidence of a destination, not of one person's identity.
    const shared = rows.length > 1;
    const names = rows
      .slice(0, 20)
      .map((row) => (row.unit.trim() ? `${row.name} (${row.unit})` : row.name));
    return {
      extension,
      answeredAt,
      shared,
      label: names.length
        ? `${names.join(' / ')} — داخلی ${extension}${shared ? ' (مشترک)' : ''}`
        : `داخلی ${extension}`,
    };
  }
}
