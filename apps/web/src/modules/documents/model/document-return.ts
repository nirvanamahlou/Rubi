const workbenchReturnTabs = {
  'workbench-today': 'today',
  'workbench-files': 'files',
  'workbench-stars': 'stars',
  'workbench-calendar': 'calendar',
} as const;

export function documentReturnPath(value: string | null): string | null {
  if (!value || !(value in workbenchReturnTabs)) return null;
  return `/workbench?tab=${workbenchReturnTabs[value as keyof typeof workbenchReturnTabs]}`;
}
