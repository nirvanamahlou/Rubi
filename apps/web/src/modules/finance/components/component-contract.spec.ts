import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentSource = readFileSync(
  join(
    process.cwd(),
    'src',
    'modules',
    'finance',
    'components',
    'finance-workspace.tsx',
  ),
  'utf8',
);
const formSource = readFileSync(
  join(
    process.cwd(),
    'src',
    'modules',
    'finance',
    'components',
    'finance-preview-form.tsx',
  ),
  'utf8',
);
const pageSource = readFileSync(
  join(process.cwd(), 'src', 'app', '(crm)', 'finance', 'page.tsx'),
  'utf8',
);

describe('finance workspace component contract', () => {
  it('routes the finance page to the dedicated workspace', () => {
    expect(pageSource).toContain('FinanceWorkspace');
    expect(pageSource).not.toContain('ModuleOverview');
  });

  it('covers dashboard, filters, internal navigation and all preview states', () => {
    expect(componentSource).toContain('جست‌وجوی سراسری مالی');
    expect(componentSource).toContain('گروه‌های داخلی مالی');
    expect(componentSource).toContain('مانده بانک');
    expect(componentSource).toContain('مانده صندوق');
    expect(componentSource).toContain('حساب‌های دریافتنی');
    expect(componentSource).toContain('حساب‌های پرداختنی');
    expect(componentSource).toContain('چک نزدیک سررسید');
    expect(componentSource).toContain('سود قراردادهای نمونه');
    for (const state of ['preview', 'loading', 'empty', 'error', 'forbidden']) {
      expect(componentSource).toContain(state);
    }
  });

  it('provides create, view and edit forms for primary foundation scenarios', () => {
    for (const kind of [
      'JOURNAL',
      'RECEIPT',
      'PAYMENT',
      'CHECK',
      'INVOICE',
      'RELEASE',
    ]) {
      expect(formSource).toContain(kind);
    }
    expect(formSource).toContain('expectedVersion');
    expect(formSource).toContain('Idempotency Key');
    expect(formSource).toContain('Maker/Checker');
    expect(formSource).toContain('بررسی بدون ذخیره');
  });

  it('defines export routes but does not create fake files', () => {
    expect(componentSource).toContain(
      'financePreviewEndpointRoutes.excelExport',
    );
    expect(componentSource).toContain('financePreviewEndpointRoutes.pdfExport');
    expect(componentSource).toContain('هیچ فایل جعلی ساخته نمی‌شود');
    expect(componentSource).not.toMatch(/Blob|createObjectURL|download\s*=/);
  });

  it('labels decision gates and synthetic preview data', () => {
    expect(componentSource).toContain('نمونه طراحی و ذخیره‌نشده');
    for (const decision of [
      'DEC-OPEN-001',
      'DEC-OPEN-004',
      'DEC-OPEN-005',
      'DEC-OPEN-016',
    ]) {
      expect(componentSource).toContain(decision);
    }
  });
});
