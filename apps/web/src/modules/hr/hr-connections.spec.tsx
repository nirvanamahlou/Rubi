import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { HrConnectionDto } from '@rubi/contracts';
import { ConnectionCard } from './hr-connections-workspace';
const item: HrConnectionDto = {
  id: 'one',
  code: 'HR-LINK-ONE',
  branchId: 'b',
  target: 'finance',
  title: 'درخواست بررسی',
  message: '<script>unsafe()</script>',
  sourceCode: 'HR-SOURCE',
  sourceVersion: 2,
  sourceHref: null,
  employeeLabel: 'کارمند آزمایشی',
  status: 'SUBMITTED',
  version: 1,
  dueAt: '2026-12-01T12:00:00Z',
  createdAt: '2026-09-09T00:00:00Z',
  updatedAt: '2026-09-09T00:00:00Z',
  response: null,
  canRespond: false,
  canCancel: false,
  history: [],
};
describe('HR referral recipient card', () => {
  it('escapes shared content and withholds source/actions from unauthorized recipients', () => {
    const html = renderToStaticMarkup(
      <ConnectionCard item={item} onSaved={() => undefined} />,
    );
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>unsafe');
    expect(html).not.toContain('مشاهده پرونده مبنا');
    expect(html).not.toContain('شروع رسیدگی');
    expect(html).not.toContain('ثبت پاسخ');
    expect(html).toContain('/finance/requests?hrConnections=1');
  });
  it('offers review before reply without claiming financial execution', () => {
    const html = renderToStaticMarkup(
      <ConnectionCard
        item={{ ...item, canRespond: true }}
        onSaved={() => undefined}
      />,
    );
    expect(html).toContain('شروع رسیدگی');
    expect(html).not.toContain('پرداخت‌شده');
    const review = renderToStaticMarkup(
      <ConnectionCard
        item={{ ...item, status: 'IN_REVIEW', canRespond: true }}
        onSaved={() => undefined}
      />,
    );
    expect(review).toContain('ثبت پاسخ');
  });
});
