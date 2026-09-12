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
const coreSource = readFileSync(
  join(
    process.cwd(),
    'src',
    'modules',
    'finance',
    'components',
    'finance-core-workspace.tsx',
  ),
  'utf8',
);
const coreModelSource = readFileSync(
  join(process.cwd(), 'src', 'modules', 'finance', 'model', 'finance-core.ts'),
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
const inboxPageSource = readFileSync(
  join(process.cwd(), 'src', 'app', '(crm)', 'finance', 'requests', 'page.tsx'),
  'utf8',
);

describe('finance workspace component contract', () => {
  it('routes the finance page to the dedicated workspace', () => {
    expect(pageSource).toContain('FinanceAccountingWorkspace');
    expect(inboxPageSource).toContain('FinanceRequestInboxWorkspace');
    expect(pageSource).not.toContain('ModuleOverview');
  });

  it('separates accounting and the request inbox into independent pages', () => {
    expect(coreSource).toContain('FinanceAccountingWorkspace');
    expect(coreSource).toContain('FinanceRequestInboxWorkspace');
    expect(coreSource).toContain('title="حسابداری"');
    expect(coreSource).toContain('کارتابل درخواست‌ها');
    expect(coreSource).not.toContain('role="tablist"');
    expect(coreSource).toContain('درخت کدینگ حساب‌ها');
    expect(coreSource).toContain('گروه ← کل ← معین ← تفصیلی');
    expect(coreSource).toContain('حساب بانکی یا صندوق مقصد');
    expect(coreSource).toContain('حساب بانکی یا صندوق مبدأ');
    expect(coreSource).toContain('نام قرارداد');
    expect(coreSource).toContain('مانده فعلی قرارداد');
    expect(coreSource).toContain('کارگزار / تأمین‌کننده');
    expect(coreSource).toContain('افزودن پرداخت جزئی');
    expect(coreSource).toContain('حذف پرداخت');
    expect(coreSource).toContain('روش پرداخت');
    expect(coreModelSource).toContain('حواله بانکی');
    expect(coreSource).toContain("part.method === 'CHECK'");
    expect(coreSource).toContain('توضیح مالی (اختیاری)');
    expect(coreSource).toContain('فیش‌ها و مدارک همراه درخواست');
    expect(coreSource).toContain('فیشی همراه این درخواست ثبت نشده است.');
    expect(coreSource).not.toContain('label="Idempotency Key"');
    expect(coreSource).not.toContain('label="Version"');
    expect(coreSource).toContain('هیچ درخواست عملیاتی ثبت نمی‌شود');
    expect(coreSource).toContain('<FinanceWorkspace />');
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
