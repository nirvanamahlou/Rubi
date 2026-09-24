import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { catalogFavoriteIds, ReportingWorkspace } from './reporting-workspace';
import { reportCatalog } from '../model/reporting';

describe('catalog report favorites', () => {
  it('keeps catalog bookmarks separate from configured and shared saved reports', () => {
    expect(
      catalogFavoriteIds([
        {
          id: 'catalog-1',
          reportCode: 'sales_by_organization',
          name: 'فروش',
          filterState: { catalogFavorite: true },
          isFavorite: true,
          isSharedWithActor: false,
        },
        {
          id: 'configured-1',
          reportCode: 'sales_by_service_route',
          name: 'گزارش با فیلتر',
          filterState: { fromDate: '2026-09-01' },
          isFavorite: true,
          isSharedWithActor: false,
        },
        {
          id: 'shared-1',
          reportCode: 'payments_refunds',
          name: 'گزارش اشتراکی',
          filterState: { catalogFavorite: true },
          isFavorite: true,
          isSharedWithActor: true,
        },
        {
          id: 'unknown-1',
          reportCode: 'unknown_report',
          name: 'ناشناخته',
          filterState: { catalogFavorite: true },
          isFavorite: true,
          isSharedWithActor: false,
        },
      ]),
    ).toEqual({ sales_by_organization: 'catalog-1' });
  });

  it('renders the favorite shelf below the catalog filters and exposes a star on every report', () => {
    const html = renderToStaticMarkup(<ReportingWorkspace view="catalog" />);
    expect(html.indexOf('همه وضعیت‌های اتصال')).toBeLessThan(
      html.indexOf('گزارش‌های مورد علاقه من'),
    );
    expect(html).not.toContain('گزارش‌های کاتالوگ');
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(
      reportCatalog.length,
    );
    expect(html).toContain('افزودن به گزارش‌های مورد علاقه من');
    expect(html).not.toContain('RPT-001');
    expect(html).toContain('جست‌وجو در عنوان یا دسته گزارش');
  });
});
