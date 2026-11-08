import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { TodayCallFilterControls } from './today-call-filters';
vi.mock('@/components/ui/native-search-select', () => ({
  NativeSearchSelect: ({
    optionLimit: _limit,
    ...props
  }: React.SelectHTMLAttributes<HTMLSelectElement> & {
    optionLimit: number;
  }) => {
    void _limit;
    return <select {...props} />;
  },
}));
it('offers three labelled controls, all outcomes, and distinct current destinations', () => {
  const html = renderToStaticMarkup(
    <TodayCallFilterControls
      filters={{ direction: '', outcome: 'UNKNOWN', unit: '' }}
      destinations={['فروش', 'فروش', 'مالی']}
      onChange={vi.fn()}
    />,
  );
  for (const label of ['جهت تماس', 'نتیجه تماس', 'وصل شده به'])
    expect(html).toContain(`aria-label="${label}"`);
  expect(html.match(/value="فروش"/g)).toHaveLength(1);
  expect(html).toContain('value="UNKNOWN" selected=""');
  expect(html.match(/value=""/g)).toHaveLength(3);
});
