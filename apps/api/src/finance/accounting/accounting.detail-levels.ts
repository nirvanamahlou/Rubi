import {
  accountingDetailLevels,
  type AccountingDetailIds,
} from '@nora/contracts';
import { Prisma } from '@nora/database';

export const detailFields = accountingDetailLevels.map(
  (level) => `detail${level}Id` as const,
);

// Only the fixed Accounting detail-level list supplies SQL identifiers.
export const journalDetailSql = Prisma.join(
  detailFields.map((field) => Prisma.raw(`l."${field}"`)),
);

export function detailIds(row: Partial<AccountingDetailIds>): string[] {
  return detailFields
    .map((field) => row[field])
    .filter((id): id is string => !!id);
}

export function lineDetails(row: AccountingDetailIds): AccountingDetailIds {
  return {
    detail4Id: row.detail4Id,
    detail5Id: row.detail5Id,
    detail6Id: row.detail6Id,
    ...Object.fromEntries(
      detailFields
        .slice(3)
        .flatMap((field) => (row[field] ? [[field, row[field]]] : [])),
    ),
  };
}
