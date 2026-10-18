import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import Page from '../../app/(crm)/correspondence/internal/page';
import { InternalLetterInbox } from './internal-letter-inbox';
import { OutgoingLetterWorkspace } from './outgoing-letter-workspace';
import { AccessPermissionsProvider } from '@/modules/iam/access-context';
vi.mock('next/navigation', () => ({
  usePathname: () => '/correspondence/internal',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));
describe('internal correspondence screens', () => {
  it('offers separate send and receive destinations', () => {
    const html = renderToStaticMarkup(<Page />);
    expect(html).toContain('/correspondence/internal/send');
    expect(html).toContain('/correspondence/internal/received');
    expect(html).toContain('تهیه نامه و ارسال');
    expect(html).toContain('مشاهده و پیگیری');
  });
  it('shows four empty-state metrics, filters and a paged column table without invented data', () => {
    const html = renderToStaticMarkup(
      <AccessPermissionsProvider value={[]}>
        <InternalLetterInbox />
      </AccessPermissionsProvider>,
    );
    for (const label of [
      'کل نامه‌های دریافتی',
      'خوانده‌نشده',
      'تأیید',
      'نیازمند اصلاح',
      'شماره یا موضوع نامه',
      'وضعیت',
      'شرکت',
      'فقط خوانده‌نشده',
      'عملیات',
    ])
      expect(html).toContain(label);
    expect(html.match(/<article/g)).toHaveLength(4);
    expect(html).toContain('<table');
    expect(html).toContain('در حال بارگذاری نامه‌ها');
  });
  it('shares the outgoing composer and adds an initially disabled send action next to downloads', () => {
    const html = renderToStaticMarkup(
      <AccessPermissionsProvider value={[]}>
        <OutgoingLetterWorkspace internal />
      </AccessPermissionsProvider>,
    );
    for (const label of [
      'ارسال نامه داخلی',
      'قالب آماده',
      'گیرنده',
      'فرستنده',
      'خروجی عکس',
      'خروجی PDF',
    ])
      expect(html).toContain(label);
    expect(html).toMatch(/disabled=""[^>]*>[^]*?ارسال<\/button>/);
  });
});
