import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContractPdfPreview, contractPdfPath } from './contract-pdf-preview';

it('builds the authenticated saved-contract PDF path without mixing request ids', () => {
  expect(contractPdfPath('contract/id')).toBe(
    '/sales/contracts/contract%2Fid/pdf',
  );
  const html = renderToStaticMarkup(
    <ContractPdfPreview contractId="contract-1" contractNumber="SC-TEST-001" />,
  );
  expect(html).toContain('در حال ساخت PDF قرارداد');
  expect(html).not.toContain('contract-1');
});
