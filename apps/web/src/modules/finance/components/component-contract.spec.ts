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
const liveInboxSource = readFileSync(
  join(
    process.cwd(),
    'src',
    'modules',
    'finance',
    'components',
    'finance-inbox-live-workspace.tsx',
  ),
  'utf8',
);
const deliveryPanelSource = readFileSync(
  join(
    process.cwd(),
    'src',
    'modules',
    'finance',
    'components',
    'finance-delivery-panel.tsx',
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
const inboxPageSource = readFileSync(
  join(process.cwd(), 'src', 'app', '(crm)', 'finance', 'requests', 'page.tsx'),
  'utf8',
);
const accountingNavigationSource = readFileSync(
  join(
    process.cwd(),
    'src',
    'modules',
    'finance',
    'components',
    'accounting-navigation-workspace.tsx',
  ),
  'utf8',
);
const accountingRouteSource = readFileSync(
  join(
    process.cwd(),
    'src',
    'app',
    '(crm)',
    'finance',
    'accounting',
    '[...slug]',
    'page.tsx',
  ),
  'utf8',
);

describe('finance workspace component contract', () => {
  it('routes the finance page to the dedicated workspace', () => {
    expect(pageSource).toContain('AccountingNavigationWorkspace');
    expect(inboxPageSource).toContain('FinanceRequestInboxWorkspace');
    expect(pageSource).not.toContain('ModuleOverview');
  });

  it('provides the requested collapsible accounting navigation with empty destinations', () => {
    for (const label of [
      'دفتر کل',
      'اطلاعات پایه',
      'حساب‌ها',
      'اسناد',
      'عملیات پایان سال',
      'گزارش‌ها',
      'دریافت و پرداخت',
      'گزارش پرداخت و دریافت',
      'ارتباط با سامانه مودیان مالیاتی',
      'حسابداری مالیاتی',
    ]) {
      expect(accountingNavigationSource).toContain(label);
    }
    expect(accountingNavigationSource).toContain('بازکردن منوی حسابداری');
    expect(accountingNavigationSource).toContain('جمع‌کردن منوی حسابداری');
    expect(accountingNavigationSource).toContain(
      'accountingNavigationGroups.map((group) => group.id)',
    );
    expect(accountingNavigationSource).toContain('group.items.length > 0');
    expect(accountingNavigationSource).not.toContain('if (group.href)');
    expect(accountingNavigationSource).toContain('در انتظار تعریف جزئیات');
    expect(accountingNavigationSource).toContain('usePageBreadcrumbs');
    expect(accountingNavigationSource).not.toMatch(
      /fetch\(|financeInboxPreview/,
    );
    expect(accountingRouteSource).toContain('AccountingNavigationWorkspace');
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
    expect(coreSource).toContain('نرخ روز هر ۱');
    expect(coreSource).toContain('معادل ریالی با نرخ روز');
    expect(coreSource).toContain('سابقه دریافت‌های قرارداد');
    expect(coreSource).toContain('payment.exchangeRateToIrr');
    expect(coreSource).toContain('توضیح مالی (اختیاری)');
    expect(coreSource).toContain('فیش‌ها و مدارک همراه درخواست');
    expect(coreSource).toContain('فیشی همراه این درخواست ثبت نشده است.');
    expect(coreSource).not.toContain('label="Idempotency Key"');
    expect(coreSource).not.toContain('label="Version"');
    expect(coreSource).toContain('هیچ درخواست عملیاتی ثبت نمی‌شود');
    expect(coreSource).toContain('<FinanceInboxLiveWorkspace />');
    expect(coreSource).toContain('<FinanceDeliveryPanel />');
    expect(componentSource).not.toContain('<FinanceDeliveryPanel />');
    expect(coreSource).not.toContain('<InboxSpace />');
    expect(liveInboxSource).toContain('صف درخواست‌های مالی');
    expect(liveInboxSource).not.toContain('Live sources');
    expect(liveInboxSource).not.toContain('عملیات مالی پس از فعال‌سازی');
    expect(liveInboxSource).toContain('origin');
    expect(liveInboxSource).toContain('تأیید دریافت');
    expect(liveInboxSource).toContain('واریز به حساب');
    expect(liveInboxSource).toContain('انتخاب حساب مقصد');
    expect(liveInboxSource).toContain("accountId: actionKind === 'APPROVE'");
    expect(liveInboxSource).toContain(
      'account.branchId === actionItem?.branchReference',
    );
    expect(liveInboxSource).toContain('درخواست اصلاح');
    expect(liveInboxSource).toContain('ثبت پرداخت کارگزار');
    expect(liveInboxSource).toContain('حساب پرداخت‌کننده');
    expect(liveInboxSource).toContain('نرخ روز ارز به ریال');
    expect(liveInboxSource).toContain('مانده فعلی');
    expect(liveInboxSource).not.toContain('financeInboxPreviewRequests');
    expect(coreSource).toContain('<FinanceWorkspace />');
  });

  it('presents supplier settlement and document delivery as two clear steps', () => {
    expect(deliveryPanelSource).toContain('کنترل مالی قرارداد');
    expect(deliveryPanelSource).toContain('۱. پرداخت خدمات به کارگزاران');
    expect(deliveryPanelSource).toContain('۲. مجوز تحویل مدارک به فروش');
    expect(deliveryPanelSource).toContain('وضعیت پرداخت هر خدمت این قرارداد');
    expect(deliveryPanelSource).toContain('این مرحله هنوز فعال نیست');
    expect(deliveryPanelSource).toContain('صدور مجوز تحویل مدارک');
    expect(deliveryPanelSource).toContain('void load()');
    expect(deliveryPanelSource).toContain('savePayment');
    expect(deliveryPanelSource).toContain('updateDelivery');
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
