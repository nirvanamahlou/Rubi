import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { HrBootstrapDto } from '@nora/contracts';
import { HrPayrollWorksheet } from './hr-payroll-worksheet';

const data = {
  branches: [],
  capabilities: { sensitive: true, write: true, approve: false },
} as unknown as HrBootstrapDto;
describe('live payroll settings entry', () => {
  it('starts with no injected employees, periods, sample salaries or bank accounts', () => {
    const html = renderToStaticMarkup(<HrPayrollWorksheet data={data} />);
    expect(html).toContain('افزودن حقوق');
    expect(html).toContain('تنظیمات حقوق');
    expect(html).not.toContain('DEMO-');
    expect(html).not.toContain('کارمند نمونه');
    expect(html).not.toContain('دریافت نسخه داده‌ها');
    expect(html).not.toContain('بازنشانی نمونه');
    expect(html).not.toContain('data-row=');
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
