import * as v from './accounting.validation';

type Note = {
  id: string;
  title: string;
  date: string;
  text: string;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
};
function parse(value: unknown): Note[] {
  if (value === undefined || value === null || value === '') return [];
  let rows: unknown = value;
  if (typeof rows === 'string') {
    try {
      rows = JSON.parse(rows);
    } catch {
      v.invalid('یادداشت معتبر نیست.');
    }
  }
  if (!Array.isArray(rows) || rows.length > 10)
    v.invalid('حداکثر ده یادداشت مجاز است.');
  return rows as Note[];
}
export function setupNotes(
  value: unknown,
  previous: unknown,
  actorName: string,
): Note[] {
  const old = parse(previous),
    seen = new Set<string>(),
    now = new Date().toISOString();
  return parse(value).map((raw) => {
    const row = v.object(raw),
      id = v.uuid(row.id)!;
    if (seen.has(id)) v.invalid('شناسه یادداشت تکراری است.');
    seen.add(id);
    const title = v.text(row.title, 160, true),
      text = v.text(row.text, 1000),
      date = v.date(row.date, true) ?? '';
    const existing = old.find((note) => note.id === id);
    if (
      existing &&
      existing.title === title &&
      existing.text === text &&
      existing.date === date
    )
      return existing;
    return {
      id,
      title,
      text,
      date,
      createdBy: existing?.createdBy ?? actorName,
      createdAt: existing?.createdAt ?? now,
      updatedBy: actorName,
      updatedAt: now,
    };
  });
}
