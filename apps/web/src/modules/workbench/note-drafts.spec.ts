import { describe, expect, it } from 'vitest';
import { notesWithTemplates, noteTemplates } from './note-drafts';

describe('saved notes and starter templates', () => {
  it('replaces a starter card with its persisted starred copy after reload', () => {
    const saved = {
      ...noteTemplates[0]!,
      id: 'saved-note',
      template: false,
      pinned: true,
      version: 1,
    };
    const shown = notesWithTemplates([saved]);
    expect(shown.filter((note) => note.title === saved.title)).toEqual([saved]);
    expect(shown).toHaveLength(noteTemplates.length);
  });
});
