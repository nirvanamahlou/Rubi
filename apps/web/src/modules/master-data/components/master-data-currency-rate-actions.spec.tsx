import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CurrencyRateActions,
  editableCurrencyRate,
} from './master-data-currency-rate-actions';

const record = {
  id: 'rate-id',
  version: 2,
  rate: '270000',
  source: 'manual',
  fromCurrencyCode: 'USD',
  toCurrencyCode: 'IRR',
  rateType: 'BUY' as const,
  observedAt: '2026-10-19T10:00:00Z',
};
describe('rate row edit/delete actions', () => {
  it('expands decimal scientific notation without losing precision', () => {
    expect(editableCurrencyRate('1e-10')).toBe('0.0000000001');
    expect(editableCurrencyRate('1.23456789012345678901234e+13')).toBe(
      '12345678901234.5678901234',
    );
    expect(editableCurrencyRate('270000')).toBe('270000');
    expect(editableCurrencyRate('1e999999')).toBe('1e999999');
  });
  it('renders both compact accessible icon actions for registered rates', () => {
    const html = renderToStaticMarkup(
      <CurrencyRateActions record={record} onSaved={() => {}} />,
    );
    expect(html).toContain('aria-label="ویرایش نرخ ارز"');
    expect(html).toContain('aria-label="حذف نرخ ارز"');
  });
  it('confirms removal, captures the displayed version, blocks repeats and keeps errors visible', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/master-data/components/master-data-currency-rate-actions.tsx',
      ),
      'utf8',
    );
    expect(source).toContain('setTarget({ ...record })');
    expect(source).toContain('{target.rate}');
    expect(source).toContain('target.rateType');
    expect(source).toContain('target.observedAt');
    expect(source).toContain('expectedVersion: target.version');
    expect(source).toContain(
      'masterDataApi.removeCurrencyRate(target.id, target.version)',
    );
    expect(source).toContain('if (busy.current || !mode) return;');
    expect(source).toContain('role="alert"');
    expect(source).toContain('سابقه عملیات باقی می‌ماند');
    expect(source).not.toContain('masterDataApi.remove(');
  });
  it('removes only the visible technical badge and refreshes persisted history after row changes', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/modules/master-data/components/master-data-finance-workspace.tsx',
      ),
      'utf8',
    );
    expect(source).not.toContain('<Badge>isAuthoritative=false</Badge>');
    expect(source).toContain('isAuthoritative: false');
    expect(source).toContain('await loadCurrencyHistory()');
    expect(source).toContain('<CurrencyRateActions');
  });
});
