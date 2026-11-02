import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportHighlights } from './report-highlights';
import type { Report } from './read-client';
const data: Report['data'] = {
  calls: 0,
  contacts: 0,
  incomplete: 0,
  unindexed: 0,
  groups: [],
  sources: [],
  registrations: [],
  requests: [],
  topFollowUps: [],
  tasks: {
    activity: [],
    open: 0,
    today: 0,
    overdue: 0,
    completed: 0,
    onTime: 0,
    onTimeRate: null,
  },
};
describe('Call Center report highlights', () => {
  it('renders explicit empty states without invalid percentages or a fictional answer rate', () => {
    const html = renderToStaticMarkup(
      <ReportHighlights data={data} agents={[]} />,
    );
    expect(html).toContain('منبع گزارش کارشناسان در دسترس نیست');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
    expect(html).not.toContain('نرخ پاسخ');
  });
  it('merges identical source labels and renders bounded server ranking and historical activity', () => {
    const html = renderToStaticMarkup(
      <ReportHighlights
        data={{
          ...data,
          calls: 10,
          sources: [
            { label: 'سایت', count: 3 },
            { label: 'سایت', count: 2 },
            { label: 'گوگل', count: 5 },
          ],
          topFollowUps: [{ contactId: 'c', name: 'مخاطب نمونه', count: 7 }],
          registrations: [{ actorId: 'u', count: 9 }],
          tasks: {
            ...data.tasks,
            activity: [
              { actorId: 'u', role: 'CURRENT_OWNER', count: 4 },
              { actorId: 'u', role: 'COMPLETED_BY', count: 3 },
            ],
          },
        }}
        agents={[{ id: 'u', displayName: 'کارشناس نمونه' }]}
      />,
    );
    expect(html).not.toContain('مخاطب نمونه');
    expect(html).toContain('عملکرد تماس و وضعیت پیگیری کارشناسان');
    expect(html).toContain('50%');
    expect(html).not.toContain('30%');
    expect(html).not.toContain('بیشترین تماس خروجی');
  });
});

it('shows the operational columns and real completion denominator without outbound contact ranking', () => {
  const html = renderToStaticMarkup(
    <ReportHighlights
      data={{
        ...data,
        expertActivity: {
          unattributed: 3,
          rows: [
            {
              id: 'u',
              name: 'Synthetic',
              extensions: ['001', '002'],
              inboundAnswered: 2,
              outboundAttempts: 4,
              outboundConnected: 1,
              uniqueContacts: 3,
              open: 2,
              overdue: 1,
              total: 6,
              incomplete: 3,
              completionRate: 0.5,
              shared: true,
            },
          ],
        },
      }}
    />,
  );
  expect(html).toContain('Synthetic');
  expect(html).toContain('001');
  expect(html).toContain('002');
  expect(html).toContain('ورودی پاسخ‌داده‌شده');
  expect(html).toContain('عقب‌افتاده');
  expect(html).toContain('۵۰');
  expect(html).toContain('از');
  expect(html).not.toContain('بیشترین تماس خروجی');
  expect(html).toContain('بدون انتساب معتبر');
});
