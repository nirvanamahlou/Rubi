import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LinkedRequestField } from './linked-request-field';
import type { SelectHTMLAttributes } from 'react';
vi.mock('@/components/ui/native-search-select', () => ({
  NativeSearchSelect: (props: SelectHTMLAttributes<HTMLSelectElement>) => (
    <select {...props} />
  ),
}));
const render = (requests: { id: string; title: string; status: string }[]) =>
  renderToStaticMarkup(
    <LinkedRequestField
      requests={requests}
      busy={false}
      selected="closed"
      onChange={() => {}}
    />,
  );
it('hides the whole field for new contacts and contacts with only closed requests', () => {
  expect(render([])).toBe('');
  expect(
    render([{ id: 'closed', title: 'Closed request', status: 'CLOSED' }]),
  ).toBe('');
});
it('shows only open choices with a clear label, without automatically linking a request', () => {
  const html = render([
    { id: 'closed', title: 'Closed request', status: 'CLOSED' },
    { id: 'open', title: 'Visa request', status: 'NEW' },
  ]);
  expect(html).toContain('این تماس مربوط به کدام درخواست است؟');
  expect(html).toContain('Visa request');
  expect(html).not.toContain('Closed request');
  expect(html).toContain('value="" selected=""');
});
