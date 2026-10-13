import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AccessGroupCard } from './access-group-card';

const render = (count: number, total = 3) =>
  renderToStaticMarkup(
    <AccessGroupCard
      id="tickets"
      title="مدیریت بلیت"
      count={count}
      total={total}
      onChange={() => {}}
    >
      <span>CHILD ACCESS</span>
    </AccessGroupCard>,
  );

describe('checkbox-first access groups', () => {
  it('shows a parent checkbox without a dropdown and hides unselected children', () => {
    const html = render(0);
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain('<details');
    expect(html).not.toContain('CHILD ACCESS');
  });
  it('reveals selected children and keeps them visible after removing a sibling', () => {
    expect(render(3)).toContain('CHILD ACCESS');
    const partial = render(2);
    expect(partial).toContain('CHILD ACCESS');
    expect(partial).toContain('aria-checked="mixed"');
    expect(partial).toContain('aria-controls=');
  });
  it('clearing the group hides its children and an unavailable group is disabled', () => {
    expect(render(0)).not.toContain('CHILD ACCESS');
    expect(render(0, 0)).toContain('disabled=""');
  });
});
