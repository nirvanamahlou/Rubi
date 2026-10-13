export type Theme = 'light' | 'dark';

export function resolveThemePreference(saved: string | null): Theme {
  return saved === 'dark' ? 'dark' : 'light';
}
