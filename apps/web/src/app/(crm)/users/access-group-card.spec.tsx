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

describe('independent access group disclosure', () => {
  it('offers a separate disclosure even before any access is selected', () => {
    const html = render(0);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('نمایش زیربخش‌ها');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('CHILD ACCESS');
  });
  it('reveals selected children and keeps them visible after removing a sibling', () => {
    expect(render(3)).toContain('CHILD ACCESS');
    const partial = render(2);
    expect(partial).toContain('CHILD ACCESS');
    expect(partial).toContain('aria-checked="mixed"');
    expect(partial).toContain('aria-expanded="true"');
  });
  it('keeps an unavailable group disabled without removing its disclosure', () => {
    expect(render(0)).not.toContain('CHILD ACCESS');
    expect(render(0, 0)).toContain('disabled=""');
    expect(render(0, 0)).toContain('نمایش زیربخش‌ها');
  });
  it('offers scoped search when the expanded group has searchable choices', () => {
    const html = renderToStaticMarkup(
      <AccessGroupCard
        id="hr"
        title="منابع انسانی"
        count={1}
        total={4}
        onChange={() => {}}
      >
        {() => <span>جزییات دسترسی</span>}
      </AccessGroupCard>,
    );
    expect(html).toContain('type="search"');
    expect(html).toContain('جست‌وجوی زیربخش‌ها و مجوزهای منابع انسانی');
    expect(html).toContain('جزییات دسترسی');
  });
});
