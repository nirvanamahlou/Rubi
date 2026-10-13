import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ProcurementRequestV1 } from '@nora/contracts';
import type { Bootstrap } from './api';
import { emptyDraft } from './model';
import { RequestDetail } from './workspace';

const bootstrap: Bootstrap = {
  permissions: [
    'procurement.approve',
    'procurement.assign',
    'procurement.request.cancel',
    'procurement.request.submit',
  ],
  branches: [],
  currencies: [],
  requester: null,
  documents: 'UNAVAILABLE',
  finance: 'NOT_CONNECTED',
  travel: 'NOT_CONNECTED',
  policy: 'POLICY_NOT_CONFIGURED',
};
function render(status: ProcurementRequestV1['status']) {
  const request: ProcurementRequestV1 = {
    id: 'request',
    number: 'PR-1',
    version: 1,
    status,
    requesterUserId: 'requester',
    ownerUserId: null,
    createdAt: '',
    updatedAt: '',
    draft: { ...emptyDraft(), title: 'درخواست دفتر', branchId: 'branch' },
  };
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <RequestDetail
        request={request}
        bootstrap={bootstrap}
        onEdit={() => undefined}
        onChanged={() => undefined}
        initialKind="quotations"
      />
    </QueryClientProvider>,
  );
}
describe('Request decision state and compact owner controls', () => {
  it('does not offer approval before a real approval workflow exists', () => {
    const html = render('SUBMITTED');
    expect(html).toContain('ارسال برای تأیید');
    expect(html).not.toContain('>رد درخواست<');
    expect(html).not.toContain('>تأیید<');
  });
  it('shows only approval and rejection decisions with no correction or redundant owner search', () => {
    const html = render('IN_REVIEW');
    expect(html).toContain('>تأیید<');
    expect(html).toContain('>رد درخواست<');
    expect(html).not.toContain('بازگشت برای اصلاح');
    expect(html).not.toContain('proc-owner-search');
  });
});
