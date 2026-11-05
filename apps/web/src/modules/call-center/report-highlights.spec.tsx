import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportHighlights } from './report-highlights';
import type { ExpertRow, Report } from './read-client';
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
          contacts: 10,
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
    expect(html).toContain('50 50');
    expect(html).not.toContain('30 70');
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

it('uses contact-based source share for repeated calls', () => {
  const html = renderToStaticMarkup(
    <ReportHighlights
      data={{
        ...data,
        calls: 28,
        contacts: 1,
        sources: [{ label: 'معرفی دوستان', count: 1 }],
      }}
      agents={[]}
    />,
  );
  expect(html).toContain('سهم منابع آشنایی');
  expect(html).toContain('کل مخاطبان');
  expect(html).toContain('100 0');
  expect(html).toContain('۱۰۰٪');
  expect(html).not.toContain('۲۸');
});

describe('expert activity totals', () => {
  const row: ExpertRow = {
    id: 'first',
    name: 'First synthetic expert',
    extensions: ['101'],
    inboundAnswered: 1,
    outboundAttempts: 0,
    outboundConnected: 0,
    uniqueContacts: 1,
    open: 2,
    overdue: 1,
    total: 1,
    incomplete: 0,
    completionRate: 1,
    shared: true,
  };
  const footerText = (html: string) =>
    html.match(/<tfoot\b[^>]*>([\s\S]*?)<\/tfoot>/)?.[1] ?? '';
  const cells = (footer: string) =>
    [...footer.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map((match) =>
      match[1]!
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim(),
    );

  it('sums every authorized expert row and weights completion by calls instead of averaging rates', () => {
    const html = renderToStaticMarkup(
      <ReportHighlights
        data={{
          ...data,
          calls: 111,
          contacts: 99,
          expertActivity: {
            unattributed: 80,
            rows: [
              row,
              {
                ...row,
                id: 'second',
                name: 'Second synthetic expert',
                extensions: ['102'],
                inboundAnswered: 2,
                outboundAttempts: 7,
                outboundConnected: 4,
                uniqueContacts: 5,
                open: 8,
                overdue: 1,
                total: 9,
                incomplete: 9,
                completionRate: 0,
              },
            ],
          },
        }}
      />,
    );
    const footer = footerText(html);
    expect(footer).toMatch(/<th\b[^>]*scope="row"[^>]*>جمع کل<\/th>/);
    expect(cells(footer)).toEqual([
      '۳',
      '۷',
      '۴',
      '۶',
      '۱۰',
      '۲',
      '۱۰٪ (۱ از ۱۰)',
    ]);
    expect(footer).not.toContain('<button');
    expect(footer).not.toContain('۱۱۱');
    expect(footer).not.toContain('۸۰');
    expect(html).toContain('تماس چندکارشناسی');
    expect(html).toContain('بدون انتساب معتبر');
  });

  it('keeps zero-call experts in the total and shows no invented completion percentage', () => {
    const html = renderToStaticMarkup(
      <ReportHighlights
        data={{
          ...data,
          expertActivity: {
            unattributed: 0,
            rows: [
              {
                ...row,
                inboundAnswered: 0,
                uniqueContacts: 0,
                total: 0,
                completionRate: null,
                shared: false,
              },
            ],
          },
        }}
      />,
    );
    expect(cells(footerText(html))).toEqual([
      '۰',
      '۰',
      '۰',
      '۰',
      '۲',
      '۱',
      '—',
    ]);
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it('does not manufacture a total when the expert report is unavailable or empty', () => {
    const unavailable = renderToStaticMarkup(<ReportHighlights data={data} />);
    const empty = renderToStaticMarkup(
      <ReportHighlights
        data={{ ...data, expertActivity: { rows: [], unattributed: 3 } }}
      />,
    );
    expect(unavailable).not.toContain('<tfoot');
    expect(empty).not.toContain('<tfoot');
    expect(unavailable).toContain('منبع گزارش کارشناسان در دسترس نیست');
    expect(empty).toContain('کارشناس یا فعالیت دارای انتساب معتبر');
    expect(empty).toContain('بدون انتساب معتبر');
  });
});
