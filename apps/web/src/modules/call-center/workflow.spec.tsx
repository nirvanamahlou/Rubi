import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import {
  WorkflowEditor,
  requestLabels,
  requestStatusOptions,
} from './workflow';
import type { RequestCase } from './workflow-client';

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
  expect(html.match(/<button[^>]*aria-label="وضعیت"[^>]*>/)?.[0]).toContain(
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
});
