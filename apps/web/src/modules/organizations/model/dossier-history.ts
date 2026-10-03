export interface DossierHistory {
  organizationId: string;
  screen: string;
  tab: string;
  creditTab: string;
}
const key = 'noraOrganizationDossier';
export function readDossierHistory(state: unknown): DossierHistory | null {
  if (!state || typeof state !== 'object') return null;
  const value = (state as Record<string, unknown>)[key];
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (
    !['organizationId', 'screen', 'tab', 'creditTab'].every(
      (name) => typeof item[name] === 'string',
    )
  )
    return null;
  const history = item as unknown as DossierHistory;
  if (history.screen === 'access')
    return {
      ...history,
      screen: 'home',
      tab: 'profile',
      creditTab: 'policy',
    };
  return history.screen === 'reports' &&
    (history.tab === 'audit' || history.tab === 'export')
    ? { ...history, tab: 'reports' }
    : history;
}
export function pushDossierHistory(value: DossierHistory | null) {
  if (
    JSON.stringify(readDossierHistory(window.history.state)) ===
    JSON.stringify(value)
  )
    return;
  // Preserve Next.js routing metadata; history contains identifiers, never record data.
  window.history.pushState(
    { ...window.history.state, [key]: value },
    '',
    window.location.href,
  );
}
