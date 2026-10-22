import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import { WorkflowEditor } from './workflow';
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
  it('does not expose a status selector when creating a new request', () => {
    const html = renderToStaticMarkup(
      <WorkflowEditor {...props} editor={{ kind: 'request' }} />,
    );
    expect(html).toContain('name="title"');
    expect(html).toContain('name="reason"');
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
    expect(html).toContain('name="status"');
    expect(html).toContain('value="CLOSED" selected=""');
  });
});
