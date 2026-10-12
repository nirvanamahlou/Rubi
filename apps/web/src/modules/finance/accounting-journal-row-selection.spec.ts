import { describe, expect, it } from 'vitest';
import type { AccountingLineV1 } from '@nora/contracts';
import {
  copyJournalRows,
  journalRowIndices,
  pasteJournalRows,
  removeJournalRows,
} from './accounting-journal-row-selection';

const row = (description: string): AccountingLineV1 => ({
  accountId: null,
  detail4Id: null,
  detail5Id: null,
  detail6Id: null,
  description,
  debit: '0',
  credit: '0',
  currency: null,
  foreignAmount: null,
  rate: null,
  fxSnapshotId: null,
  attributes: { descriptionEn: description },
});

describe('journal row selection', () => {
  it('copies nonadjacent selections in document order and pastes independent rows', () => {
    const rows = ['a', 'b', 'c', 'd'].map(row);
    const clipboard = copyJournalRows(rows, [3, 1, 1, -1, 9], 0);
    expect(clipboard.map((item) => item.description)).toEqual(['b', 'd']);
    const pasted = pasteJournalRows(rows, clipboard, 0);
    expect(pasted.rows.map((item) => item.description)).toEqual([
      'a',
      'b',
      'd',
      'b',
      'c',
      'd',
    ]);
    expect(pasted.indices).toEqual([1, 2]);
    pasted.rows[1]!.attributes.descriptionEn = 'changed';
    expect(clipboard[0]!.attributes.descriptionEn).toBe('b');
    expect(rows[1]!.attributes.descriptionEn).toBe('b');
  });
  it('cuts only selected rows and falls back to the focused row when selection is empty', () => {
    const rows = ['a', 'b', 'c', 'd'].map(row);
    expect(
      removeJournalRows(rows, [3, 1], 0).map((item) => item.description),
    ).toEqual(['a', 'c']);
    expect(journalRowIndices(4, [], 2)).toEqual([2]);
    expect(
      removeJournalRows(rows, [], 2).map((item) => item.description),
    ).toEqual(['a', 'b', 'd']);
    expect(copyJournalRows([], [], 0)).toEqual([]);
  });
});
