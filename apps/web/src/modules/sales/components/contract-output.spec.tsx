import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ContractOutputButton } from './contract-output';

it('labels the contract action without PDF wording by default', () => {
  const html = renderToStaticMarkup(
    <ContractOutputButton contractId="synthetic" />,
  );
  expect(html).toContain('قرارداد');
  expect(html).not.toContain('PDF');
  expect(html).not.toContain('خروجی قرارداد');
});

it('preserves explicit action labels', () => {
  const html = renderToStaticMarkup(
    <ContractOutputButton contractId="synthetic" label="قرارداد" />,
  );
  expect(html).toContain('قرارداد');
});
