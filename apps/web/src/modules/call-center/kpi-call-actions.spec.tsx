import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { KpiCallActions, type KpiCallMode } from './kpi-call-actions';
import type { ContactSummary } from './read-client';

const call: ContactSummary['latest'] = {
  id: 'missed-call',
  contactId: 'contact-from-server',
  name: 'Synthetic contact',
  phone: '+12025550123',
  occurredAt: '2026-11-03T07:00:00Z',
  direction: 'INBOUND',
  subject: 'Synthetic missed call',
  source: 'نامشخص',
  operator: 'نامشخص',
  status: 'بدون پاسخ',
};
const props = {
  mode: 'missed-callbacks' as const,
  call,
  callCount: 3,
  canComplete: false,
  canCreateRequest: true,
  onComplete: vi.fn(async () => {}),
};

describe('missed callback request action', () => {
  it.each([false, undefined])(
    'fails closed for absent or denied server capability (%s)',
    (capability) => {
      const base = {
        mode: props.mode,
        call,
        callCount: 3,
        canComplete: false,
        onComplete: props.onComplete,
      };
      const action = (
        <KpiCallActions
          {...base}
          {...(capability === undefined
            ? {}
            : { canCreateRequest: capability })}
          onRequest={vi.fn()}
        />
      );
      expect(renderToStaticMarkup(action)).not.toContain('ثبت درخواست');
    },
  );
  it('allows a manager to request follow-up even without call-edit access', () => {
    const html = renderToStaticMarkup(
      <KpiCallActions {...props} onRequest={vi.fn()} />,
    );
    expect(html).toContain('ثبت درخواست');
    expect(html).toMatch(/disabled=""[^>]*>ویرایش اطلاعات تماس/);
    expect(html).not.toMatch(/disabled=""[^>]*>ثبت درخواست/);
  });
  it('does not show request creation without the authorized manager callback', () => {
    expect(renderToStaticMarkup(<KpiCallActions {...props} />)).not.toContain(
      'ثبت درخواست',
    );
  });
  it.each(['without-outcome', 'today', 'week'] satisfies KpiCallMode[])(
    'keeps %s actions unchanged',
    (mode) => {
      const html = renderToStaticMarkup(
        <KpiCallActions {...props} mode={mode} onRequest={vi.fn()} />,
      );
      expect(html).not.toContain('ثبت درخواست');
      expect(html).toContain('ویرایش اطلاعات تماس');
    },
  );
  it('requires a server contact identity instead of inventing one from the phone', () => {
    const withoutContact = { ...call };
    delete withoutContact.contactId;
    expect(
      renderToStaticMarkup(
        <KpiCallActions {...props} call={withoutContact} onRequest={vi.fn()} />,
      ),
    ).not.toContain('ثبت درخواست');
  });
  it('opens the existing request flow with the exact selected contact and call context', () => {
    const onRequest = vi.fn();
    const tree = KpiCallActions({ ...props, onRequest });
    const children = (
      tree.props as { children: ReactElement<{ onClick: () => void }>[] }
    ).children;
    children[1]!.props.onClick();
    expect(onRequest).toHaveBeenCalledExactlyOnceWith({
      id: call.contactId,
      latest: call,
      callCount: 3,
    });
  });
});
