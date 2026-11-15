import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InsurancePolicyPdfLink } from './policy-pdf-link';
vi.mock('@/lib/environment', () => ({ getPublicApiBaseUrl: () => '/api' }));

it('offers the scoped reservation PDF for an issued contract policy', () => {
  const html = renderToStaticMarkup(
    <InsurancePolicyPdfLink
      policy={{ id: 'policy', intakeId: 'intake', status: 'ISSUED' }}
    />,
  );
  expect(html).toContain(
    'href="/api/reservations/requests/intake/insurance/pdf/policy"',
  );
  expect(html).toContain('دانلود PDF بیمه‌نامه');
});
it('preserves download for issued standalone policies', () => {
  expect(
    renderToStaticMarkup(
      <InsurancePolicyPdfLink
        policy={{
          id: 'policy',
          intakeId: null,
          standalone: true,
          status: 'ISSUED',
        }}
      />,
    ),
  ).toContain('href="/api/reservations/insurance/standalone/policy/pdf"');
});
it.each(['DRAFT', 'INPUT_ERROR', 'PROVIDER_ERROR', 'CANCELLED'] as const)(
  'does not offer a PDF for %s',
  (status) => {
    expect(
      renderToStaticMarkup(
        <InsurancePolicyPdfLink
          policy={{ id: 'policy', intakeId: 'intake', status }}
        />,
      ),
    ).toBe('');
  },
);
it('does not generate an invalid URL when the reservation is missing', () => {
  expect(
    renderToStaticMarkup(
      <InsurancePolicyPdfLink
        policy={{ id: 'policy', intakeId: null, status: 'ISSUED' }}
      />,
    ),
  ).toBe('');
});
