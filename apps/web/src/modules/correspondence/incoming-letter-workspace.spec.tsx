import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { IncomingLetterWorkspace } from './incoming-letter-workspace';
vi.mock('next/navigation', () => ({
  usePathname: () => '/correspondence/incoming',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));
describe('incoming correspondence', () => {
  it('renders four metrics, relevant filters and the requested column table', () => {
    const html = renderToStaticMarkup(<IncomingLetterWorkspace />);
    for (const label of [
      'همه نامه‌ها',
      'دارای اعتبار',
      'منقضی‌شده',
      'ناقص',
      'عنوان',
      'نوع سند',
      'دسته‌بندی',
      'تاریخ اعتبار',
      'مالک',
      'شعبه',
      'فرستنده',
      'از تاریخ ثبت',
      'تا تاریخ ثبت',
    ])
      expect(html).toContain(label);
    expect(html).toContain('<table');
    expect(html).toContain('در حال دریافت');
    expect(html).not.toContain('حفاظت تا زمان بررسی امنیتی');
  });
});
