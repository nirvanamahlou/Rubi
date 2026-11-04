import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CompletionStatus } from './completion-status';

describe('completion status action', () => {
  it.each(['COMPLETE', 'INCOMPLETE'])(
    'opens the precise call for %s',
    (result) => {
      const onEdit = vi.fn();
      const button = CompletionStatus({ result, callId: 'call-a', onEdit });
      expect(button.props.disabled).toBe(false);
      button.props.onClick();
      expect(onEdit).toHaveBeenCalledExactlyOnceWith('call-a');
    },
  );

  it.each([
    { callId: undefined, onEdit: vi.fn() },
    { callId: 'call-a', onEdit: undefined },
    { callId: 'call-a', onEdit: vi.fn(), disabled: true },
  ])('does not guess IDs or bypass disabled/read-only access', (props) => {
    const button = CompletionStatus({ result: 'INCOMPLETE', ...props });
    expect(button.props.disabled).toBe(true);
    // A missing ID/handler or busy UI cannot dispatch even a direct handler call.
    button.props.onClick();
    if (props.onEdit) expect(props.onEdit).not.toHaveBeenCalled();
  });

  it('uses different colors, clear labels and keyboard-native buttons', () => {
    const done = CompletionStatus({ result: 'COMPLETE' });
    const pending = CompletionStatus({ result: 'INCOMPLETE' });
    expect(done.props.className).not.toBe(pending.props.className);
    expect(renderToStaticMarkup(done)).toContain('تکمیل‌شده');
    expect(renderToStaticMarkup(pending)).toContain('نیازمند تکمیل');
    expect(renderToStaticMarkup(done)).toMatch(/<button[^>]*type="button"/);
    expect(done.props.type).toBe('button');
  });
});
