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
      readDossierHistory({ noraOrganizationDossier: { organizationId: 7 } }),
    ).toBeNull();
  });
  it.each(['audit', 'export'])(
    'restores the legacy %s tab into the unified activity report',
    (tab) => {
      const state = {
        noraOrganizationDossier: {
          organizationId: 'org',
          screen: 'reports',
          tab,
          creditTab: 'policy',
        },
      };
      const history = {
        state,
        pushState: vi.fn(),
      };
      vi.stubGlobal('window', {
        history,
        location: { href: 'http://localhost:3100/organizations' },
      });
      expect(readDossierHistory(state)).toEqual({
        organizationId: 'org',
        screen: 'reports',
        tab: 'reports',
        creditTab: 'policy',
      });
      pushDossierHistory({
        organizationId: 'org',
        screen: 'reports',
        tab: 'reports',
        creditTab: 'policy',
      });
      expect(history.pushState).not.toHaveBeenCalled();
    },
  );
  it('restores the removed access section to the dossier home without adding history', () => {
    const state = {
      noraOrganizationDossier: {
        organizationId: 'org',
        screen: 'access',
        tab: 'history',
        creditTab: 'temporary',
      },
    };
    const history = { state, pushState: vi.fn() };
    vi.stubGlobal('window', {
      history,
      location: { href: 'http://localhost:3100/organizations' },
    });
    const dossierHome = {
      organizationId: 'org',
      screen: 'home',
      tab: 'profile',
      creditTab: 'policy',
    };

    expect(readDossierHistory(state)).toEqual(dossierHome);
    pushDossierHistory(dossierHome);
    expect(history.pushState).not.toHaveBeenCalled();
  });
});
