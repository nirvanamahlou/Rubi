import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import {
  WorkflowEditor,
  requestLabels,
  requestStatusOptions,
} from './workflow';
import type { RequestCase } from './workflow-client';
import type { Call } from './model';

vi.mock('@/components/ui/overlays', () => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: Wrapper,
    DialogContent: Wrapper,
    DialogTitle: Wrapper,
    DialogDescription: Wrapper,
  };
});
vi.mock('@/components/ui/native-search-select', () => ({
  NativeSearchSelect: ({
    optionLimit: _limit,
    ...props
  }: SelectHTMLAttributes<HTMLSelectElement> & { optionLimit?: number }) => {
    void _limit;
    return <select {...props} />;
  },
}));
const props = {
  operators: [],
  branchId: 'synthetic',
  contactId: 'synthetic',
  onClose: () => {},
  onSaved: () => {},
};
const reviewRequest: RequestCase = {
  id: 'review-request',
  version: 3,
  title: 'Request awaiting review',
  reason: 'Follow up',
  status: 'IN_PROGRESS',
  priority: 'NORMAL',
  ownerId: 'responsible-expert',
  ownerName: 'Responsible expert',
  createdAt: '2026-11-05T08:00:00Z',
  followUps: [],
  history: [],
  privateHistory: [],
  contactSummary: { name: 'Synthetic contact', phone: '5550102' },
};
const unrelatedCall: Call = {
  id: 'unrelated-call',
  name: 'Unrelated name',
  phone: '5550103',
  subject: 'Unrelated latest call',
  occurredAt: '2026-11-05T10:00:00Z',
  direction: 'INBOUND',
  recordings: [],
  source: 'نامشخص',
  operator: 'نامشخص',
  status: 'جدید',
  note: '',
};
describe('request workflow form', () => {
  it('offers only actionable request states and presents legacy open as waiting for agent', () => {
    expect(Object.keys(requestStatusOptions)).toEqual([
      'IN_PROGRESS',
      'WAITING_CUSTOMER',
      'CLOSED',
    ]);
    expect(requestLabels.NEW).toBe(requestLabels.IN_PROGRESS);
  });
  it('does not expose a status selector when creating a new request', () => {
    const html = renderToStaticMarkup(
      <WorkflowEditor {...props} editor={{ kind: 'request' }} />,
    );
    expect(html).toContain('name="title"');
    expect(html).toContain('name="reason"');
    expect(html.match(/<textarea[^>]*name="reason"[^>]*>/)?.[0]).toContain(
      'required',
    );
    expect(html).not.toContain('name="status"');
  });
  it('restores saved request fields, completion and editable closed status', () => {
    const item: RequestCase = {
      id: 'synthetic',
      version: 1,
      title: 'Saved request',
      reason: 'Saved reason',
      result: 'Saved completion',
      status: 'CLOSED',
      priority: 'HIGH',
      ownerId: null,
      ownerName: null,
      createdAt: '2026-10-22T10:00:00Z',
      followUps: [],
      history: [],
      privateHistory: [],
    };
    const html = renderToStaticMarkup(
      <WorkflowEditor {...props} editor={{ kind: 'request', item }} />,
    );
    expect(html).toContain('Saved request');
    expect(html).toContain('Saved completion');
    expect(html.match(/<textarea[^>]*name="reason"[^>]*>/)?.[0]).toContain(
      'required',
    );
    expect(html).toContain('name="status"');
    expect(html).toContain('aria-label="وضعیت"');
    expect(html).toContain('بسته‌شده');
    expect(html).toContain('data-value="HIGH"');
  });
  it('prevents editing and saving for read-only queue viewers while allowing dismissal', () => {
    const html = renderToStaticMarkup(
      <WorkflowEditor {...props} editor={{ kind: 'request' }} readOnly />,
    );
    expect(html).toContain('<fieldset disabled=""');
    expect(html).not.toContain('type="submit"');
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>بستن<\/button>/);
  });
  it('shows separate contact rows without borrowing the latest unrelated call subject', () => {
    const html = renderToStaticMarkup(
      <WorkflowEditor
        {...props}
        editor={{ kind: 'request', item: reviewRequest }}
        contactCall={unrelatedCall}
      />,
    );
    expect(html).toContain('<dt>نام مخاطب:</dt>');
    expect(html).toContain('<dd>Synthetic contact</dd>');
    expect(html).toContain('<dt>شماره تماس:</dt>');
    expect(html).toContain('<bdi dir="ltr">5550102</bdi>');
    expect(html).not.toContain('موضوع تماس:');
    expect(html).not.toContain('Unrelated latest call');
    expect(html).not.toContain('تغییرات پس از تأیید سرور');
  });
  it('shows the saved related follow-up subject and a decision action only to its reviewer', () => {
    const item: RequestCase = {
      ...reviewRequest,
      review: {
        pending: true,
        canReview: true,
        token: 'a'.repeat(64),
        subject: 'Saved related follow-up',
      },
    };
    const render = (request: RequestCase) =>
      renderToStaticMarkup(
        <WorkflowEditor
          {...props}
          editor={{ kind: 'request', item: request }}
          contactCall={unrelatedCall}
        />,
      );
    const html = render(item);
    expect(html).toContain('<dt>موضوع تماس:</dt>');
    expect(html).toContain('<dd>Saved related follow-up</dd>');
    expect(html).not.toContain('Unrelated latest call');
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>ثبت تصمیم<\/button>/);
    expect(
      render({ ...item, review: { ...item.review!, canReview: false } }),
    ).not.toContain('ثبت تصمیم');
    const reviewed = render({
      ...item,
      review: { ...item.review!, pending: false },
    });
    expect(reviewed).not.toContain('ثبت تصمیم');
    expect(reviewed).toContain('Saved related follow-up');
  });
});

it('locks only management fields for an ordinary agent and keeps progress text editable', () => {
  const item: RequestCase = {
    id: 'request',
    version: 1,
    title: 'Saved',
    reason: 'Reason',
    result: 'Progress',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    ownerId: 'agent',
    ownerName: 'Agent',
    createdAt: '2026-10-25T10:00:00Z',
    followUps: [],
    history: [],
    privateHistory: [],
    canEditManagement: false,
  };
  const html = renderToStaticMarkup(
    <WorkflowEditor {...props} editor={{ kind: 'request', item }} />,
  );
  expect(html.match(/<input[^>]*name="title"[^>]*>/)?.[0]).toContain(
    'readOnly',
  );
  expect(
    html.match(/<input[^>]*aria-label="کارشناس مسئول"[^>]*>/)?.[0],
  ).toContain('readOnly');
  expect(html.match(/<button[^>]*aria-label="وضعیت"[^>]*>/)?.[0]).not.toContain(
    'disabled',
  );
  expect(html.match(/<button[^>]*aria-label="اولویت"[^>]*>/)?.[0]).toContain(
    'disabled',
  );
  expect(html.match(/<textarea[^>]*name="result"[^>]*>/)?.[0]).not.toMatch(
    /disabled|readOnly/,
  );
  const manager = renderToStaticMarkup(
    <WorkflowEditor
      {...props}
      editor={{ kind: 'request', item: { ...item, canEditManagement: true } }}
    />,
  );
  expect(manager.match(/<input[^>]*name="title"[^>]*>/)?.[0]).not.toContain(
    'readOnly',
  );
  const closed = renderToStaticMarkup(
    <WorkflowEditor
      {...props}
      editor={{ kind: 'request', item: { ...item, status: 'CLOSED' } }}
    />,
  );
  expect(closed.match(/<button[^>]*aria-label="وضعیت"[^>]*>/)?.[0]).toContain(
    'disabled',
  );
  const closedManager = renderToStaticMarkup(
    <WorkflowEditor
      {...props}
      editor={{
        kind: 'request',
        item: { ...item, status: 'CLOSED', canEditManagement: true },
      }}
    />,
  );
  expect(
    closedManager.match(/<button[^>]*aria-label="وضعیت"[^>]*>/)?.[0],
  ).not.toContain('disabled');
});
