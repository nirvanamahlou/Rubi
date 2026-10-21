import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AGENCY_COMMISSION, readAgencyCommission } from '@nora/contracts';
import { AgencyCommission } from '../components/agency-commission';
import {
  emptySalesForm,
  salesPayload,
  contractSaleComponents,
} from './sales-form';
import { contractPrintHtml } from './contract-print';
import { printFixture, printReferences } from './contract-print.fixture';
it('shows fixed commission fields only for an agency buyer', () => {
  const state = { ...emptySalesForm, customerKind: 'organization' as const };
  const html = renderToStaticMarkup(
    <AgencyCommission state={state} onChange={() => {}} />,
  );
  expect(html).toContain('کمیسیون هر بزرگسال (ریال)');
  expect(html).toContain('کمیسیون هر کودک (ریال)');
  expect(
    renderToStaticMarkup(
      <AgencyCommission
        state={{ ...state, customerKind: 'person' }}
        onChange={() => {}}
      />,
    ),
  ).toBe('');
});
it('persists once for agency contracts without changing totals and strips stale personal commission', () => {
  const state = {
    ...emptySalesForm,
    customerKind: 'organization' as const,
    serviceKinds: ['VISA' as const],
    agencyCommission: { adult: '125000', child: '' },
    contractPrices: [{ amount: '1000000', currencyCode: 'IRR' }],
  };
  const payload = salesPayload(state);
  expect(readAgencyCommission(payload.services)).toEqual({
    adult: '125000',
    child: '0',
  });
  const withoutCommission = structuredClone(state) as typeof emptySalesForm;
  delete withoutCommission.agencyCommission;
  expect(contractSaleComponents(state)).toEqual(
    contractSaleComponents(withoutCommission),
  );
  expect(
    readAgencyCommission(
      salesPayload({ ...state, customerKind: 'person' }).services,
    ),
  ).toBeUndefined();
  expect(() =>
    salesPayload({ ...state, agencyCommission: { adult: '-1', child: '0' } }),
  ).toThrow();
});
it('prints adult and child commissions on their own rows and keeps legacy and infant behavior', () => {
  const out = structuredClone(printFixture);
  out.customer.kind = 'organization';
  out.contract.servicesDetail[0]!.metadata = {
    [AGENCY_COMMISSION]: JSON.stringify({ adult: '125000', child: '45000' }),
  };
  const html = contractPrintHtml(out, printReferences);
  const table = html.split('PASSENGERS & PRICING')[1]!.split('</table>')[0]!;
  const rows = table.split('<tbody>')[1]!.split('</tr>');
  expect(rows[0]).toContain('<td>125,000</td>');
  expect(rows[1]).toContain('<td>45,000</td>');
  expect(html).not.toContain('کمیسیون آژانس در این قرارداد ثبت نشده');
  out.contract.passengersDetail[1]!.ageCategory = 'INF';
  expect(
    contractPrintHtml(out, printReferences)
      .split('PASSENGERS & PRICING')[1]!
      .split('<tbody>')[1],
  ).toContain('<td>—</td>');
  out.customer.kind = 'person';
  expect(contractPrintHtml(out, printReferences)).not.toContain(
    '<th>کمیسیون</th>',
  );
});
