import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { IntegrationSystemConfigV1 } from '@nora/contracts';
import { DisplayLocaleContext } from '@/i18n/locale-context';
import { JahanBastanConnection } from './components/jahan-bastan-connection';
import { isJahanBastanSystem } from './system-connector';

vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'https://nora.example/api/v1',
}));
vi.mock('@/lib/auth-session', () => ({ refreshAuthenticatedSession: vi.fn() }));
const system = {
  id: 'bastan',
  brandId: 'travel-brand',
  name: 'جهان باستان',
} as IntegrationSystemConfigV1;
describe('Jahan selected-site setup', () => {
  it.each(['fa', 'en'] as const)(
    'renders the dedicated bundle flow in %s',
    (language) => {
      const html = renderToStaticMarkup(
        <DisplayLocaleContext.Provider value={language}>
          <JahanBastanConnection
            branchId="branch"
            system={system}
            onSaved={() => {}}
          />
        </DisplayLocaleContext.Provider>,
      );
      expect(html).toContain(
        language === 'fa'
          ? 'بسته اتصال جهان باستان'
          : 'Jahan Bastan connection bundle',
      );
      expect(html).not.toContain('ERP v1');
      expect(html).not.toContain('localStorage');
      expect(html).not.toContain('حضور زنده');
      if (language === 'en') expect(html).not.toMatch(/[\u0600-\u06ff]/);
    },
  );
  it('uses registered brand identity despite a translated or renamed display name', () => {
    expect(
      isJahanBastanSystem(
        { ...system, name: 'Renamed' },
        { brands: [{ id: 'travel-brand', code: 'jahan-bastan' }] as never },
      ),
    ).toBe(true);
    expect(
      isJahanBastanSystem(system, {
        brands: [{ id: 'travel-brand', code: 'niyayesh' }] as never,
      }),
    ).toBe(false);
  });
});
