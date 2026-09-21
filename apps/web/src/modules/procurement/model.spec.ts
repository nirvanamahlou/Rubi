import { describe, expect, it } from 'vitest';
import { emptyDraft, reconcileDraft } from './model';
describe('Concurrent draft reconciliation', () => {
  it('uses the general purchase type internally for a new request', () => {
    expect(emptyDraft().purchaseType).toBe('خرید عمومی');
  });

  it('merges independent edits without overwriting another writer and surfaces true conflicts', () => {
    const base = {
      ...emptyDraft(),
      title: 'عنوان اولیه',
      notes: 'یادداشت اولیه',
    };
    const local = { ...base, title: 'عنوان من', needReason: 'نیاز من' };
    const latest = { ...base, title: 'عنوان همکار', notes: 'یادداشت همکار' };
    const result = reconcileDraft(base, local, latest);
    expect(result.conflicts).toEqual(['title']);
    expect(result.merged.notes).toBe('یادداشت همکار');
    expect(result.merged.needReason).toBe('نیاز من');
    expect(local.title).toBe('عنوان من');
    expect(latest.title).toBe('عنوان همکار');
  });
  it('does not treat identical changes by both writers as a conflict', () => {
    const base = emptyDraft();
    const edited = { ...base, estimatedAmount: '9007199254740993.1000' };
    expect(reconcileDraft(base, edited, edited)).toEqual({
      conflicts: [],
      merged: edited,
    });
  });
});
