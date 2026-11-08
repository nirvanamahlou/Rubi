import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { WithoutOutcomeDialog } from './without-outcome-dialog';
vi.mock('@/components/ui/overlays', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: wrapper,
    DialogContent: wrapper,
    DialogTitle: wrapper,
    DialogDescription: wrapper,
  };
});
vi.mock('@/components/ui/native-search-select', () => ({
  NativeSearchSelect: ({ children }: { children: ReactNode }) => (
    <select>{children}</select>
  ),
}));
it.each(['today', 'week', 'without-outcome', 'missed-callbacks'] as const)(
  'limits the new controls to Today (%s)',
  (mode) => {
    const html = renderToStaticMarkup(
      <WithoutOutcomeDialog
        mode={mode}
        branch="synthetic"
        revision={0}
        hidden={false}
        canComplete={false}
        destinations={['فروش']}
        onClose={vi.fn()}
        onComplete={vi.fn(async () => {})}
      />,
    );
    expect(html.includes('فیلترهای تماس‌های امروز')).toBe(mode === 'today');
    if (mode === 'today')
      expect(html.indexOf('وصل شده به')).toBeLessThan(
        html.indexOf('تازه‌سازی فهرست'),
      );
  },
);
