import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./customer-documents-panel.tsx', import.meta.url),
  'utf8',
);
const workspace = readFileSync(
  new URL('./customer-workspace.tsx', import.meta.url),
  'utf8',
);

describe('Customer 360 documents integration boundary', () => {
  it('replaces the infrastructure placeholder with a real customer-scoped panel', () => {
    expect(workspace).toContain(
      '<CustomerDocumentsPanel customer={customer} />',
    );
    expect(workspace).not.toContain('در انتظار زیرساخت مدارک');
    expect(source).toContain('customerDocumentsApi.listForCustomer');
    expect(source).toContain('مدارک سفر و هویتی');
    expect(source).toContain('افزودن مدرک');
    expect(source).toContain('آرشیو اسناد');
  });

  it('uses only the public API consumer and preserves the Documents ownership boundary', () => {
    expect(source).toContain("from '../api/customer-documents-client'");
    expect(source).not.toMatch(/modules\/documents|documents\/components/);
    expect(source).toContain("form.set('sourceModule', 'customers')");
    expect(source).toContain("form.set('sourceEntityType', 'Customer')");
    expect(source).toContain("form.set('sourceEntityId', customer.id)");
    expect(source).toContain("form.set('branchId', customer.ownerBranchId)");
  });

  it('keeps semantic identity data behind DEC-OPEN-006 while files are operational', () => {
    expect(source).toContain('DEC-OPEN-006');
    expect(source).toContain('شماره پاسپورت');
    expect(source).toContain('فایل خصوصی و غیرقابل دریافت باقی می‌ماند');
    expect(source).not.toContain('passportNumber');
  });
});
