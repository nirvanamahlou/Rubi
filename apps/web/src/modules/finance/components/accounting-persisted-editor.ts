export type PersistedEditorRecord = { id: string; version: number };

export type PersistedEditorRun = <T = unknown>(
  action: string,
  payload: Record<string, unknown>,
  version?: number,
) => Promise<T | undefined>;

export async function submitPersistedEditor<T extends PersistedEditorRecord>(
  run: PersistedEditorRun,
  action: string,
  payload: Record<string, unknown>,
  selected: T | null,
  adopt: (record: T) => void,
): Promise<T | undefined> {
  const saved = await run<T>(
    action,
    { ...payload, ...(selected ? { id: selected.id } : {}) },
    selected?.version,
  );
  if (saved) adopt(saved);
  return saved;
}
