import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { customerAffairsHref } from './customer-affairs-navigation';

describe('Customer Affairs request follow-up navigation', () => {
  it('opens the exact request profile by row ID', () => {
    expect(customerAffairsHref('leads', 'request-42')).toBe(
      '/customer-affairs?view=leads&lead=request-42',
    );
    expect(customerAffairsHref('leads', 'request/42?')).toBe(
      '/customer-affairs?view=leads&lead=request%2F42%3F',
    );
    expect(customerAffairsHref('leads')).toBe('/customer-affairs?view=leads');
  });

  it('wires a distinct follow-up button for each request table row', () => {
    const source = readFileSync(
      new URL('./customer-affairs-nora-workspace.tsx', import.meta.url),
      'utf8',
    );
    const table = source.slice(source.indexOf('<table className={s.table}>'));
    expect(table).toContain('<th scope="col">پیگیری</th>');
    expect(table).toContain("{'stage' in row ? (");
    expect(table).toContain('<td data-label="پیگیری">');
    expect(table).toContain(
      'aria-label={`پیگیری درخواست ${row.trackingNumber}: ${row.title}`}',
    );
    expect(table).toContain("onClick={() => navigate('leads', row.id)}");
    expect(table).toContain('پیگیری');
  });

  it('uses a separate recent requests panel while preserving the Sales handoff panel', () => {
    const source = readFileSync(
      new URL('./customer-affairs-nora-workspace.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain('result.recentLeads = overview.recent');
    expect(source).toContain('آخرین درخواست‌ها');
    expect(source).toContain('منتظر پذیرش فروش');
    expect(source).toContain('loaded.recentLeads.map((row) => (');
    expect(source).toContain('هنوز درخواستی ثبت نشده است.');
    expect(source).toContain('api.leads(search, {');
    expect(source).toContain('createdFrom,');
    expect(source).toContain('createdTo,');
  });
});
