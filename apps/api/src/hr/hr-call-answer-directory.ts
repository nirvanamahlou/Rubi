import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { readFileSync, statSync } from 'node:fs';

/** Optional operator-approved bootstrap directory; never a user/permission mapping. */
export function privateAnswerDirectory(
  path: string | undefined,
  branchId: string,
  connectionId: string | undefined,
  extension?: string,
): { name: string; unit: string; position: string; extension: string }[] {
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
        (row: {
          extension?: unknown;
          name?: unknown;
          unit?: unknown;
          position?: unknown;
        }) =>
          row &&
          typeof row.extension === 'string' &&
          /^[0-9]{1,16}$/.test(row.extension) &&
          (!extension || row.extension === extension) &&
          typeof row.name === 'string' &&
          row.name.trim().length > 0 &&
          row.name.length <= 160 &&
          typeof row.unit === 'string' &&
          row.unit.length <= 320 &&
          (row.position === undefined ||
            (typeof row.position === 'string' && row.position.length <= 160)),
      )
      .slice(0, 200)
      .map(
        (row: {
          name: string;
          unit: string;
          position?: string;
          extension: string;
        }) => ({
          name: row.name.trim(),
          unit: row.unit.trim(),
          position: row.position?.trim() ?? '',
          extension: row.extension,
        }),
      );
  } catch {
    return [];
  }
}

export interface CallAnswerRecipient {
  extension: string;
  label: string;
  shared: boolean;
  answeredAt: string | null;
  observedAt?: string;
  labelSource?: 'CURRENT_DIRECTORY';
}

export function callDestinationLabel(row: {
  name: string;
  unit: string;
  position?: string;
  extension: string;
}) {
  const unit =
    row.unit
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)
      .at(-1) ?? '';
  const position = row.position?.trim() ?? '';
  const normalize = (value: string) =>
    value
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/[\s\u200c]+/g, ' ')
      .trim();
  const includesUnit =
    !!unit && ` ${normalize(position)} `.includes(` ${normalize(unit)} `);
  const title = [position, includesUnit ? '' : unit].filter(Boolean).join(' ');
  return [title || 'واحد نامشخص', row.name, row.extension].join(' - ');
}

/** Internal HR projection. The consumer must supply the authenticated call branch. */
@Injectable()
export class HrCallAnswerDirectory {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async options(branchId: string, connectionId?: string) {
    const employees = await this.db.client.hrEmployee.findMany({
      where: { branchId, deletedAt: null, status: 'فعال' },
      select: {
        name: true,
        unit: true,
        position: true,
        records: {
          where: {
            branchId,
            section: 'employee',
            tab: 'internalContact',
            deletedAt: null,
          },
          select: { values: true },
        },
      },
      orderBy: { personnelCode: 'asc' },
      take: 1000,
    });
    let rows = employees.flatMap((employee) =>
      employee.records.flatMap((record) => {
        const value = (record.values as string[] | null)?.[0];
        return typeof value === 'string' && /^[0-9]{1,16}$/.test(value)
          ? [
              {
                name: employee.name,
                unit: employee.unit,
                position: employee.position,
                extension: value,
              },
            ]
          : [];
      }),
    );
    if (
      !employees.length &&
      !(await this.db.client.hrEmployee.count({ where: { branchId } }))
    )
      rows = privateAnswerDirectory(
        process.env.CALL_CENTER_ANSWER_DIRECTORY_FILE,
        branchId,
        connectionId,
      );
    const labels = new Set<string>();
    return rows.flatMap((row) => {
      const label = callDestinationLabel(row);
      if (labels.has(label)) return [];
      labels.add(label);
      return [{ label, extension: row.extension }];
    });
  }

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
      select: { name: true, unit: true, position: true },
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
      .map((row) => callDestinationLabel({ ...row, extension }));
    return {
      extension,
      answeredAt,
      shared,
      label: names.length
        ? `${names.join(' / ')}${shared ? ' (داخلی مشترک)' : ''}`
        : `داخلی ${extension}`,
    };
  }
}
