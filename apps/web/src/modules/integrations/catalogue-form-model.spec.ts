import { describe, expect, it } from 'vitest';
import {
  catalogueChanges,
  decimalField,
  normaliseValue,
} from './catalogue-form-model';
import {
  dailySeries,
  decimalText,
  reportMetricText,
  scopedSiteReport,
  activityTitle,
} from './report-model';
import type { EditorSchema, SiteReport } from './api/client';
const baseReport: SiteReport = {
  schemaVersion: 1,
  environment: 'LOCAL',
  checkedAt: '2026-10-27T00:00:00Z',
  from: '2026-10-26',
  to: '2026-10-27',
  metrics: {},
  totals: {},
  salesByCurrency: [],
  trends: {},
  visits: {
    pageViews: 0,
    uniqueBrowsers: 0,
    definition: 'anonymous browser',
    daily: [],
  },
  activity: [],
  activityAvailable: false,
};
describe('native site catalogue and report models', () => {
  it('preserves decimal strings and nested input fields, removes output-only metadata', () => {
    const schema: EditorSchema = {
      type: 'object',
      properties: {
        price: {
          anyOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }],
        },
        departures: { type: 'array', items: { $ref: '#/$defs/Departure' } },
      },
      $defs: {
        Departure: {
          type: 'object',
          properties: {
            external_id: { type: 'string' },
            capacity: { type: 'integer' },
          },
        },
      },
    };
    expect(decimalField(schema.properties!.price!)).toBe(true);
    expect(
      normaliseValue(schema, schema, {
        id: 1,
        price: '9007199254740993.99',
        departures: [{ id: 2, external_id: 'stable', capacity: 10 }],
      }),
    ).toEqual({
      price: '9007199254740993.99',
      departures: [{ external_id: 'stable', capacity: 10 }],
    });
  });
  it('sends a minimal patch without unnecessarily republishing or clearing arrays', () => {
    const original = {
      status: 'published',
      title: 'Old',
      departures: [{ external_id: 'x' }],
    };
    expect(catalogueChanges({ ...original, title: 'New' }, original)).toEqual({
      title: 'New',
    });
    expect(catalogueChanges({ ...original, departures: [] }, original)).toEqual(
      { departures: [] },
    );
  });
  it('formats decimals without binary-number conversion and separates currencies', () => {
    expect(decimalText('9007199254740993.99')).toBe('۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۹۹۳٫۹۹');
    const report: SiteReport = {
      ...baseReport,
      metrics: { sales: { value: 2, state: 'AVAILABLE' } },
      salesByCurrency: [
        { amount: '10.01', currency: 'USD', complete: true },
        { amount: null, currency: 'IRR', complete: false },
      ],
    };
    expect(reportMetricText(report, 'sales')).toBe('۱۰٫۰۱ USD / مبلغ ناقص IRR');
    expect(
      reportMetricText(
        {
          ...report,
          salesByCurrency: [],
          metrics: { sales: { value: 0, state: 'AVAILABLE' } },
        },
        'sales',
      ),
    ).toBe('۰ · بدون فروش');
  });
  it('fills only dates in the selected range with actual zero counts', () => {
    const report: SiteReport = {
      ...baseReport,
      from: '2026-10-26',
      to: '2026-10-28',
      trends: { orders: [{ date: '2026-10-27', value: 2 }] },
    };
    expect(dailySeries(report, 'orders').map((r) => r.value)).toEqual([
      0, 2, 0,
    ]);
  });
});

describe('site-specific report presentation', () => {
  it('never shows another site or stale period in the selected site panel', () => {
    const report = { ...baseReport, registrySystemId: 'site-a' };
    const result = { report, state: 'available' as const };
    expect(scopedSiteReport(result, 'site-a', report.from, report.to)).toBe(
      report,
    );
    expect(
      scopedSiteReport(result, 'site-b', report.from, report.to),
    ).toBeNull();
    expect(
      scopedSiteReport(result, 'site-a', '2026-10-01', report.to),
    ).toBeNull();
    expect(
      scopedSiteReport(undefined, 'site-b', report.from, report.to),
    ).toBeNull();
  });
  it('translates activity without exposing internal resource and operation codes', () => {
    expect(activityTitle('customer-orders', 'upsert')).toBe(
      'ثبت یا ویرایش سفارش',
    );
    expect(activityTitle('customer-travelers', 'archive')).toBe(
      'بایگانی مسافر',
    );
    expect(activityTitle('unknown-table', 'strange-code')).toBe(
      'تغییر اطلاعات سایت',
    );
  });
});
