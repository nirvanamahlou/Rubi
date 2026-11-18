import { createHash } from 'node:crypto';
import type {
  AccountingAccountV1,
  AccountingAttributes,
} from '@nora/contracts';

export interface RootChartReference {
  code: string;
  title: string;
  level: 'GROUP' | 'GENERAL';
  parentCode: string | null;
  nature: AccountingAccountV1['nature'];
  permanent: boolean;
  accountType: 'PERMANENT' | 'TEMPORARY' | 'MEMORANDUM';
}

function identity(bookId: string, code: string) {
  const bytes = createHash('sha256')
    .update(`rahkaran-group-general-v1:${bookId}:${code}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 15) | 80;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Definition-only preflight: never updates/deletes existing accounts or creates subsidiaries. */
export function planRootChart(
  bookId: string,
  existing: readonly (Pick<
    AccountingAccountV1,
    'id' | 'bookId' | 'code' | 'title' | 'parentId' | 'permanent'
  > & { level: string; nature: string })[],
  reference: readonly RootChartReference[],
) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      bookId,
    )
  )
    throw new Error('Invalid destination book identity');
  if (existing.some((row) => row.bookId !== bookId))
    throw new Error('Foreign-book account in snapshot');
  const byCode = new Map(reference.map((row) => [row.code, row]));
  if (byCode.size !== reference.length || !reference.length)
    throw new Error('Invalid reference catalogue');
  for (const row of reference) {
    if (!['GROUP', 'GENERAL'].includes(row.level))
      throw new Error('Only GROUP and GENERAL are permitted');
    if (!row.title.trim() || !['DEBIT', 'CREDIT', 'ANY'].includes(row.nature))
      throw new Error('Invalid reference account');
    if (
      !['PERMANENT', 'TEMPORARY', 'MEMORANDUM'].includes(row.accountType) ||
      (row.accountType !== 'TEMPORARY') !== row.permanent
    )
      throw new Error('Inconsistent reference account type');
    if (row.level === 'GROUP') {
      if (!/^\d{2}$/.test(row.code) || row.parentCode !== null)
        throw new Error('Invalid root group');
    } else {
      const parent = byCode.get(row.parentCode ?? '');
      if (
        !/^\d{4}$/.test(row.code) ||
        parent?.level !== 'GROUP' ||
        !row.code.startsWith(parent.code)
      )
        throw new Error('Invalid general-account parent');
    }
  }
  const existingByCode = new Map(existing.map((row) => [row.code, row]));
  if (existingByCode.size !== existing.length)
    throw new Error('Duplicate destination codes');
  const ids = new Map(
    reference.map((row) => [
      row.code,
      existingByCode.get(row.code)?.id ?? identity(bookId, row.code),
    ]),
  );
  const create = [];
  let matched = 0;
  for (const row of [...reference].sort(
    (a, b) => a.code.length - b.code.length || a.code.localeCompare(b.code),
  )) {
    const parentId = row.parentCode ? ids.get(row.parentCode)! : null;
    const current = existingByCode.get(row.code);
    if (current) {
      if (
        current.title !== row.title ||
        current.level !== row.level ||
        current.parentId !== parentId ||
        current.nature !== row.nature ||
        current.permanent !== row.permanent
      )
        throw new Error(`Existing account differs: ${row.code}`);
      matched++;
      continue;
    }
    if (existing.some((account) => account.id === ids.get(row.code)))
      throw new Error('Destination identity collision');
    create.push({
      id: ids.get(row.code)!,
      parentId,
      code: row.code,
      title: row.title,
      titleEn: null,
      level: row.level,
      nature: row.nature,
      permanent: row.permanent,
      active: true,
      attributes: {
        accountType: row.accountType,
        description: '',
      } satisfies AccountingAttributes,
    });
  }
  return { create, matched, untouched: existing.length };
}
