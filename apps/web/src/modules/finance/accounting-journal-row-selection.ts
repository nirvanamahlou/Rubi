import type { AccountingLineV1 } from '@nora/contracts';

export function journalRowIndices(
  length: number,
  indices: number[],
  focused: number,
): number[] {
  const valid = [...new Set(indices)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < length)
    .sort((a, b) => a - b);
  return valid.length
    ? valid
    : focused >= 0 && focused < length
      ? [focused]
      : [];
}

export function copyJournalRows(
  rows: AccountingLineV1[],
  indices: number[],
  focused: number,
): AccountingLineV1[] {
  return structuredClone(
    journalRowIndices(rows.length, indices, focused).map(
      (index) => rows[index]!,
    ),
  );
}

export function removeJournalRows(
  rows: AccountingLineV1[],
  indices: number[],
  focused: number,
): AccountingLineV1[] {
  const selected = new Set(journalRowIndices(rows.length, indices, focused));
  return rows.filter((_, index) => !selected.has(index));
}

export function pasteJournalRows(
  rows: AccountingLineV1[],
  clipboard: AccountingLineV1[],
  after: number,
): { rows: AccountingLineV1[]; indices: number[] } {
  const position = Math.max(0, Math.min(after + 1, rows.length));
  const next = [...rows];
  next.splice(position, 0, ...structuredClone(clipboard));
  return { rows: next, indices: clipboard.map((_, index) => position + index) };
}
