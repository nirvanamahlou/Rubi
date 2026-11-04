export interface NoteDraft {
  id: string;
  title: string;
  body: string;
  folder: string;
  tags: string;
  items: { text: string; done: boolean }[];
  pinned: boolean;
  updatedAt: string | null;
  template: boolean;
  version?: number;
  reminderAt?: string | null;
}

export const WORKBENCH_NOTE_FAVORITES_CHANGED =
  'nora:workbench:note-favorites-changed';

export function filterNoteDrafts(
  notes: NoteDraft[],
  search: string,
  folder: string,
  from: string,
  to: string,
) {
  const query = search.trim().toLocaleLowerCase('fa');
  return notes
    .filter(
      (note) =>
        (!folder || note.folder === folder) &&
        (!query ||
          [
            note.title,
            note.body,
            note.tags,
            ...note.items.map((item) => item.text),
          ]
            .join(' ')
            .toLocaleLowerCase('fa')
            .includes(query)) &&
        (!from ||
          Boolean(
            note.updatedAt && note.updatedAt.slice(0, 10) >= from.slice(0, 10),
          )) &&
        (!to ||
          Boolean(
            note.updatedAt && note.updatedAt.slice(0, 10) <= to.slice(0, 10),
          )),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
    );
}
