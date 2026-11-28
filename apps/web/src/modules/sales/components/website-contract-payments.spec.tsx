import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { useLegalEntityContext } from '@/modules/legal-entities/components/legal-entity-context';
import { WebsiteContractPayments } from './website-contract-payments';

vi.mock('@/modules/legal-entities/components/legal-entity-context', () => ({
  useLegalEntityContext: vi.fn(),
}));

it.each([
  ['NIYAYESH_SEIR_SAHAR', false, true],
  ['NIYAYESH_SEIR_SAHAR', true, false],
  ['JAHAN_BASTAN', false, false],
  ['GHESATI_RO', false, false],
  ['ALL', false, false],
  [null, false, false],
] as const)(
  'renders the receipt list for %s (switching: %s) only when eligible',
  (selection, switching, visible) => {
    vi.mocked(useLegalEntityContext).mockReturnValue({
      context: selection ? { selection } : null,
      switching,
    } as ReturnType<typeof useLegalEntityContext>);
    const html = renderToStaticMarkup(<WebsiteContractPayments />);
    expect(html.includes('پرداخت‌های آنلاین سایت نیایش')).toBe(visible);
  },
);
