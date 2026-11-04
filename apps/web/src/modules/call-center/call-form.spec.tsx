import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import { CallForm } from './call-form';
import { previewCalls } from './fixture-data';

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
describe('existing call form completion', () => {
  it.each(['INBOUND', 'OUTBOUND'] as const)(
    'requires an explicit outcome for a %s popup',
    (direction) => {
      const html = renderToStaticMarkup(
        <CallForm
          branchId="test"
          event={{ ...previewCalls()[0]!, direction }}
          previous={undefined}
          onSave={async () => {}}
          onClose={() => {}}
          busy={false}
        />,
      );
      expect(html).toContain('نتیجه تماس *');
      expect(html).not.toContain('نتیجه تماس (اختیاری)');
      expect(html).toMatch(/<select[^>]*name="outcome"[^>]*required=""/);
      expect(html).toContain('value=""');
    },
  );
  it.each([
    ['INBOUND', 'ورودی ـ تماس به شرکت'],
    ['OUTBOUND', 'خروجی ـ تماس از شرکت'],
  ] as const)(
    'locks the saved %s direction when editing a call',
    (direction, label) => {
      const call = {
        ...previewCalls()[0]!,
        completionToken: 'a'.repeat(64),
        direction,
      };
      const html = renderToStaticMarkup(
        <CallForm
          branchId="test"
          event={call}
          previous={{
            ...call,
            direction: direction === 'INBOUND' ? 'OUTBOUND' : 'INBOUND',
          }}
          onSave={async () => {}}
          onClose={() => {}}
          busy={false}
        />,
      );
      expect(html).toContain(
        `aria-label="نوع تماس" readOnly="" value="${label}"`,
      );
      expect(html).toContain(
        `type="hidden" name="direction" value="${direction}"`,
      );
      expect(html).not.toMatch(/<select[^>]*name="direction"/);
      expect(html).toContain(
        `aria-label="${direction === 'OUTBOUND' ? 'تماس‌گرفته‌شده از داخلی' : 'وصل شده به'}"`,
      );
    },
  );
  it('restores saved business fields while retaining the same technical identity', () => {
    const call = {
      ...previewCalls()[0]!,
      completionToken: 'a'.repeat(64),
      subject: 'Saved subject',
      note: 'Saved note',
      source: 'سایت',
      operator: 'فروش داخلی',
      outcome: 'NO_ANSWER',
    };
    const html = renderToStaticMarkup(
      <CallForm
        branchId="test"
        event={call}
        previous={call}
        onSave={async () => {}}
        onClose={() => {}}
        busy={false}
      />,
    );
    expect(html).toContain('value="Saved subject"');
    expect(html).toContain('Saved note</textarea>');
    expect(html).toContain('value="NO_ANSWER" selected=""');
    expect(html).toContain('value="سایت" selected=""');
    expect(html).toMatch(/readonly=""/i);
  });
  it('does not copy previous conversation notes/result into a new follow-up', () => {
    const previous = {
      ...previewCalls()[0]!,
      subject: 'Old subject',
      note: 'Old private note',
      outcome: 'NO_ANSWER',
    };
    const html = renderToStaticMarkup(
      <CallForm
        branchId="test"
        event={{
          id: 'new',
          phone: previous.phone,
          direction: 'OUTBOUND',
          occurredAt: previous.occurredAt,
          recordings: [],
        }}
        previous={previous}
        onSave={async () => {}}
        onClose={() => {}}
        busy={false}
      />,
    );
    expect(html).not.toContain('Old private note');
    expect(html).not.toContain('value="Old subject"');
    expect(html).not.toContain('value="NO_ANSWER" selected=""');
    expect(html).toMatch(/<select[^>]*name="direction"/);
  });
});

it('shows the server-confirmed answer read-only without exposing a manual selector', () => {
  const call = {
    ...previewCalls()[0]!,
    completionToken: 'a'.repeat(64),
    operator: 'داخلی 203',
    answerRecipient: {
      extension: '203',
      label: 'Person A / Person B — داخلی 203 (مشترک)',
      shared: true,
      answeredAt: '2026-10-22T10:00:00Z',
    },
  };
  const html = renderToStaticMarkup(
    <CallForm
      branchId="test"
      event={call}
      previous={call}
      onSave={async () => {}}
      onClose={() => {}}
      busy={false}
    />,
  );
  expect(html).toContain('Person A / Person B');
  expect(html).toContain('type="hidden" name="operator" value="داخلی 203"');
  expect(html).not.toMatch(/<select[^>]*name="operator"/);
});

it('exposes a non-submit minimize action only when hosted and disables it during saving', () => {
  const call = previewCalls()[0]!;
  const props = {
    branchId: 'test',
    event: call,
    previous: call,
    onSave: async () => {},
    onClose: () => {},
  };
  const unhosted = renderToStaticMarkup(<CallForm {...props} busy={false} />);
  expect(unhosted).not.toContain('کوچک‌کردن فرم تماس');
  const hosted = renderToStaticMarkup(
    <CallForm {...props} busy onMinimize={() => {}} />,
  );
  const button = hosted.match(
    /<button[^>]*aria-label="کوچک‌کردن فرم تماس"[^>]*>/,
  )?.[0];
  expect(button).toContain('type="button"');
  expect(button).toContain('disabled');
});
