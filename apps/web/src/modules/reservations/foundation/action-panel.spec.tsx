import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContractActionPanel, ContractActionContent } from './action-panel';
import type { RequestView } from './model';
const request: RequestView = {
  id: 'test',
  contractNumber: 'SYNTH-01',
  branchId: 'a',
  branchName: 'Test branch',
  issuerName: '—',
  customerName: 'Synthetic customer',
  salesCounter: '—',
  assignee: null,
  passengerNames: ['Synthetic passenger'],
  services: [],
  priority: 'UNSPECIFIED',
  deadline: null,
  createdAt: '2026-09-09T00:00:00Z',
  status: 'NEW',
  issues: [],
};
describe('selected contract actions', () => {
  it('keeps remaining actions visible and disabled without a selection', () => {
    const html = renderToStaticMarkup(<ContractActionPanel />);
    expect(html.match(/disabled=""/g) ?? []).toHaveLength(14);
    for (const label of ['واچر', 'مشخصات کلی', 'دریافت‌ها', 'مدارک', 'توضیحات'])
      expect(html).toContain(label);
    for (const removed of [
      'Confirmation',
      'پیوست',
      'طرف قرارداد',
      'پیامک',
      'ارسال ایمیل',
      'ثبت توضیحات',
    ])
      expect(html).not.toContain(removed);
  });
  it('enables dialogs for the selected contract without embedding other records', () => {
    const html = renderToStaticMarkup(
      <ContractActionPanel request={request} />,
    );
    expect(html).toContain('SYNTH-01');
    expect(html).not.toContain('disabled=""');
    expect(html.match(/aria-haspopup="dialog"/g) ?? []).toHaveLength(13);
    expect(html).toContain('href="/contracts/terms.pdf"');
    expect(html).toContain('download="مفاد.pdf"');
  });
  it('loads canonical passenger names for the selected request', () => {
    const html = renderToStaticMarkup(
      <ContractActionContent action="اسامی مسافران" request={request} />,
    );
    expect(html).toContain('در حال دریافت اطلاعات مسافران');
    expect(html).not.toContain('Synthetic passenger');
    expect(html).not.toContain('Synthetic customer');
  });
  it('does not invent writable forms or unknown customer details', () => {
    const html = renderToStaticMarkup(
      <ContractActionContent action="خرید" request={request} />,
    );
    expect(html).toContain('جزئیات این فرم هنوز تعیین نشده');
    expect(html).not.toContain('<input');
    const missing = renderToStaticMarkup(
      <ContractActionContent
        action="طرف قرارداد"
        request={{ ...request, customerName: '—' }}
      />,
    );
    expect(missing).toContain('در اطلاعات دریافتی موجود نیست');
  });
});

it('marks notes only for the selected contract with notes', () => {
  expect(
    renderToStaticMarkup(
      <ContractActionPanel request={{ ...request, hasNotes: true }} />,
    ),
  ).toContain('توضیحات؛ این قرارداد یادداشت دارد');
  expect(
    renderToStaticMarkup(
      <ContractActionPanel request={{ ...request, hasNotes: false }} />,
    ),
  ).not.toContain('این قرارداد یادداشت دارد');
});
