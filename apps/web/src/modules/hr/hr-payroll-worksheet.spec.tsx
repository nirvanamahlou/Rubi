import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { emptyPayrollRow, type HrBootstrapDto } from '@nora/contracts';
import { HrPayrollWorksheet } from './hr-payroll-worksheet';
import { pastePayrollGrid } from './hr-payroll-grid';

const data = {
  branches: [],
  capabilities: { sensitive: true, write: true, approve: false },
} as unknown as HrBootstrapDto;
describe('live payroll settings entry', () => {
  it('pastes only into visible rows without changing hidden employees', () => {
    const rows = ['a', 'b', 'c'].map(emptyPayrollRow);
    const result = pastePayrollGrid(
      rows,
      ['a', 'c'],
      'a',
      'daily',
      '100\n200',
      () => 'new',
    );
    expect(result.map((row) => row.daily)).toEqual(['100', '0', '200']);
    expect(rows.map((row) => row.daily)).toEqual(['0', '0', '0']);
  });
  it('validates the whole paste before replacing data and preserves formula cells', () => {
    const rows = [emptyPayrollRow('a')];
    expect(() =>
      pastePayrollGrid(rows, ['a'], 'a', 'days', '30\t999\n32', () => 'new'),
    ).toThrow();
    expect(rows[0]!.days).toBe('0');
    const result = pastePayrollGrid(
      rows,
      ['a'],
      'a',
      'days',
      '30\t999\t200',
      () => 'new',
    );
    expect(result[0]!.days).toBe('30');
    expect(result[0]!.housing).toBe('200');
    expect(result[0]).not.toHaveProperty('monthly');
  });
  it('appends blank rows for overflow and enforces the 500-row limit', () => {
    expect(
      pastePayrollGrid(
        [emptyPayrollRow('a')],
        ['a'],
        'a',
        'name',
        'First\nSecond',
        () => 'new',
      ).map((row) => row.name),
    ).toEqual(['First', 'Second']);
    const rows = Array.from({ length: 500 }, (_, i) =>
      emptyPayrollRow(String(i)),
    );
    expect(() =>
      pastePayrollGrid(rows, ['0'], '0', 'name', 'First\nSecond', () => 'new'),
    ).toThrow();
  });
  it('starts with no injected employees, periods, sample salaries or bank accounts', () => {
    const html = renderToStaticMarkup(<HrPayrollWorksheet data={data} />);
    expect(html).toContain('افزودن حقوق');
    expect(html).toContain('تنظیمات حقوق');
    expect(html).not.toContain('DEMO-');
    expect(html).not.toContain('کارمند نمونه');
    expect(html).not.toContain('دریافت نسخه داده‌ها');
    expect(html).not.toContain('بازنشانی نمونه');
    expect(html).not.toContain('data-row=');
    expect(html).toContain('فیلتر فهرست حقوق');
    expect(html).toContain('دوره یا شعبه');
    expect(html).toContain('همه سال‌ها');
    expect(html).toContain('همه ماه‌ها');
    expect(html).toContain('همه وضعیت‌ها');
    expect(html).toContain('پاک‌کردن فیلترها');
    expect(html.match(/افزودن حقوق/g)).toHaveLength(1);
  });
  it('requires sensitive access and hides creation controls from denied readers', () => {
    const html = renderToStaticMarkup(
      <HrPayrollWorksheet
        data={{
          ...data,
          capabilities: { ...data.capabilities, sensitive: false },
        }}
      />,
    );
    expect(html).toContain('مجوز اطلاعات حساس');
    expect(html).not.toContain('افزودن حقوق');
  });
  it('disables creation for a read-only sensitive user', () => {
    const html = renderToStaticMarkup(
      <HrPayrollWorksheet
        data={{ ...data, capabilities: { ...data.capabilities, write: false } }}
      />,
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?افزودن حقوق/);
  });
});
