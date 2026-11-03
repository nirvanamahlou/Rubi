import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import { CallForm } from './call-form';
import { previewCalls } from './fixture-data';

const seen = vi.hoisted(() => new Map<string, number | undefined>());
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
    optionLimit,
    ...props
  }: SelectHTMLAttributes<HTMLSelectElement> & { optionLimit?: number }) => {
    seen.set(String(props.name), optionLimit);
    return <select {...props} />;
  },
}));

it('makes all published source and outcome choices visible without a search query', () => {
  const html = renderToStaticMarkup(
    <CallForm
      branchId="synthetic"
      event={previewCalls()[0]!}
      previous={undefined}
      onSave={async () => {}}
      onClose={() => {}}
      busy={false}
    />,
  );
  expect(html).toContain('اشتباه گرفته شده');
  expect(html).toContain('آژانس');
  expect(html).toContain('SMS');
  expect(seen.get('outcome')).toBeGreaterThanOrEqual(6);
  expect(seen.get('source')).toBeGreaterThanOrEqual(9);
});
