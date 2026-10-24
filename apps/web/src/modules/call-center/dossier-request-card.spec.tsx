import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DossierRequestCard, requestClosedAt } from './dossier-request-card';
import type { RequestCase } from './workflow-client';

const request: RequestCase = {
  id: 'test',
  version: 1,
  title: 'Test request',
  reason: 'Test reason',
  ownerName: 'Test owner',
  ownerId: 'test',
  priority: 'HIGH',
  status: 'NEW',
  createdAt: '2026-10-20T10:00:00Z',
  privateHistory: [],
  history: [],
  followUps: [],
};
const event = (status: string, at: string) => ({
  at,
  status,
  actorId: 'test',
  title: 'Test',
  reason: '',
  ownerId: 'test',
  version: 1,
});
describe('dossier request summary', () => {
  it('keeps original closure time across edits, and uses the new closure after reopening', () => {
    const closed = {
      ...request,
      status: 'CLOSED',
      privateHistory: [
        event('NEW', '2026-10-20T10:00:00Z'),
        event('CLOSED', '2026-10-21T10:00:00Z'),
        event('CLOSED', '2026-10-21T11:00:00Z'),
      ],
    };
    expect(requestClosedAt(closed)).toBe('2026-10-21T10:00:00Z');
    expect(
      requestClosedAt({
        ...closed,
        privateHistory: [
          ...closed.privateHistory,
          event('NEW', '2026-10-22T08:00:00Z'),
          event('CLOSED', '2026-10-22T09:00:00Z'),
        ],
      }),
    ).toBe('2026-10-22T09:00:00Z');
    expect(requestClosedAt({ ...closed, status: 'NEW' })).toBeNull();
  });
  it('shows only ordered requested information and one edit action', () => {
    const html = renderToStaticMarkup(
      <DossierRequestCard request={request} canManage onEdit={() => {}} />,
    );
    const labels = [
      'عنوان درخواست',
      'دلیل تغییر، بستن یا بازگشایی',
      'کارشناس مسئول',
      'اولویت',
      'وضعیت',
      'تاریخ و ساعت باز شدن',
      'ویرایش درخواست',
    ];
    const positions = labels.map((label) => html.indexOf(label));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).not.toContain('تاریخ و ساعت بسته شدن');
    expect(html).toContain('منتظر اقدام کارشناس');
  });
});
