import { describe, expect, it } from 'vitest';
import { filterNoteDrafts, type NoteDraft } from './note-drafts';

const saved: NoteDraft = {
  id: 'saved-note',
  title: 'ایده بهبود تحویل پرونده',
  body: 'متن شخصی ذخیره‌شده',
  folder: 'ایده‌ها',
  tags: '',
  items: [],
  pinned: true,
  updatedAt: '2026-11-04T08:00:00Z',
  template: false,
  version: 1,
};

describe('personal note listing', () => {
  it('preserves a saved note even when its title matches a former example', () => {
    expect(filterNoteDrafts([saved], '', '', '', '')).toEqual([saved]);
  });
  it('keeps an empty server list empty after deletion', () => {
    expect(filterNoteDrafts([], '', '', '', '')).toEqual([]);
  });
});
