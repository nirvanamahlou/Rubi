import { afterEach, describe, expect, it, vi } from 'vitest';
import { pushDossierHistory, readDossierHistory } from './dossier-history';

afterEach(() => vi.unstubAllGlobals());
describe('dossier browser history', () => {
  it('preserves Next routing state and does not create duplicate entries', () => {
    const history = {
      state: { __NA: true, tree: ['routing'] },
      pushState: vi.fn((state) => {
        history.state = state;
      }),
    };
    vi.stubGlobal('window', {
      history,
      location: { href: 'http://localhost:3100/organizations' },
    });
    const entry = {
      organizationId: 'org',
      screen: 'contracts',
      tab: 'framework',
      creditTab: 'policy',
    };
    pushDossierHistory(entry);
    pushDossierHistory(entry);
    expect(history.pushState).toHaveBeenCalledTimes(1);
    expect(history.state).toMatchObject({ __NA: true, tree: ['routing'] });
    expect(readDossierHistory(history.state)).toEqual(entry);
    pushDossierHistory(null);
    expect(readDossierHistory(history.state)).toBeNull();
    expect(history.pushState).toHaveBeenCalledTimes(2);
  });
  it('ignores unrelated or malformed history entries', () => {
    expect(readDossierHistory(null)).toBeNull();
    expect(readDossierHistory({ __NA: true })).toBeNull();
    expect(
      readDossierHistory({ rubiOrganizationDossier: { organizationId: 7 } }),
    ).toBeNull();
  });
});
