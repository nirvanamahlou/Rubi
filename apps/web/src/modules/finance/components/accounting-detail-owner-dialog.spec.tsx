import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import {
  accountingDetailOwners,
  detailOwnerKind,
  type AccountingSnapshotV1,
} from '@nora/contracts';
import { AccountingDetailOwnerDialog } from './accounting-detail-owner-dialog';
import { LedgerPersonDialog } from './ledger-person-dialog';
import {
  BankAccountTypeDialog,
  BankRialDialog,
} from './accounting-bank-type-currency-dialogs';
import {
  BankBranchDialog,
  BankInstitutionDialog,
} from './accounting-bank-reference-dialogs';
vi.mock('@/components/ui/overlays', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('@/modules/iam/access-context', () => ({
  useAccessPermissions: () => [
    'finance.account.manage',
    'master_data.read',
    'master_data.create',
  ],
  useRouteAccess: () => () => true,
}));
vi.mock('./accounting-setup-notes', () => ({
  parseSetupNotes: () => [],
  AccountingSetupNotes: () => <div>یادداشت‌های دوره مالی</div>,
}));
const book = {
  book: {
    id: 'book-a',
    title: 'شرکت آزمایشی',
    branchId: 'branch-a',
    baseCurrency: 'IRR',
  },
  details: [],
  configurations: [],
} as unknown as AccountingSnapshotV1;
function render(kind: (typeof accountingDetailOwners)[number]['kind']) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AccountingDetailOwnerDialog
        kind={kind}
        book={book}
        run={vi.fn()}
        onSelected={vi.fn()}
        onClose={vi.fn()}
      />
    </QueryClientProvider>,
  );
}
describe('dedicated detail owner forms', () => {
  it.each(accountingDetailOwners)(
    'shows the dedicated $title form and its required controls',
    ({ kind, title }) => {
      const html = render(kind);
      expect(html).toContain(kind === 'BANK' ? 'تعریف' : 'ایجاد');
      expect(html).toContain(title);
      if (kind !== 'BANK') {
        expect(html).toContain('aria-label="کد مرجع"');
        expect(html).toContain('aria-label="عنوان مرجع"');
        expect(html).toContain('ذخیره و انتخاب');
      }
    },
  );
  it('binds a branch to the current enterprise with a read-only enterprise name', () => {
    const html = render('BRANCH');
    expect(html).toContain('شرکت آزمایشی');
    expect(html).toContain('readOnly=""');
    expect(html).toContain('شعبه اصلی');
  });
  it('does not reuse a simple-title form for a funding source, center, cashbox or bank', () => {
    const fund = render('FUND');
    for (const text of ['نوع منبع', 'وضعیت منبع', 'طبقه اعتبار'])
      expect(fund).toContain(text);
    expect(render('COST_CENTER')).toContain('نوع مرکز هزینه');
    expect(render('CASH')).toContain('مسئول صندوق');
    expect(render('PETTY_CASH')).toContain('تنخواه‌دار');
    expect(render('PETTY_CASH')).toContain('تاریخ استقرار');
    expect(render('BANK')).toContain('نام بانک');
    expect(render('FISCAL_YEAR')).toContain('یادداشت‌های دوره مالی');
  });
  it('renders the banking fields and all three institution choices', () => {
    const html = render('BANK');
    for (const label of [
      'نام بانک',
      'شعبه بانک',
      'کد شعبه',
      'شهر شعبه',
      'شماره حساب',
      'نوع ارز',
      'نوع حساب',
      'موجودی ذخیره',
      'مبلغ اهمیت',
      'اعتبار حساب',
      'شبا',
      'حساب پشتیبان',
      'انتقال خودکار',
      'روش انتقال',
      'شرح به زبان دوم',
      'امضاکنندگان دسته چک',
    ])
      expect(html).toContain(label);
    const client = new QueryClient();
    const bank = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <BankInstitutionDialog onSaved={vi.fn()} onClose={vi.fn()} />
      </QueryClientProvider>,
    );
    for (const label of [
      'بانک',
      'مؤسسه مالی و اعتباری',
      'صندوق قرض‌الحسنه',
      'نام به زبان دوم',
      'کد بانک',
      'تلفن روابط عمومی',
      'وب‌سایت',
      'کد سوئیفت',
    ])
      expect(bank).toContain(label);
  });

  it('shows the complete bank branch definition and keeps the native bank and city selectors', () => {
    const html = renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <BankBranchDialog
          bankId="existing-bank"
          onSaved={vi.fn()}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );
    for (const field of [
      'نام بانک',
      'نام شعبه',
      'نام به زبان دوم',
      'کد شعبه',
      'شهر شعبه',
      'کد سوئیفت',
      'تلفن',
      'نشانی',
      'وب‌سایت',
    ])
      expect(html).toContain(field);
  });

  it('renders only account type name and checkbook availability as editable fields', () => {
    const html = renderToStaticMarkup(
      <BankAccountTypeDialog
        run={vi.fn()}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(html).toContain('id="bank-account-type-title"');
    expect(html).toContain('دسته چک دارد');
    expect(html).not.toContain('bank-account-type-code');
  });

  it('renders the existing active Rial with its canonical values and exposes the select action', () => {
    const client = new QueryClient();
    client.setQueryData(['accounting', 'bank-title-rial', true], {
      data: [
        {
          code: 'IRR',
          name: 'ریال',
          status: 'active',
          attributes: { englishName: 'Rial', decimalDigits: 0, symbol: 'ریال' },
        },
      ],
    });
    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <BankRialDialog
          catalogueAccess
          canCreate={false}
          onSelected={vi.fn()}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );
    for (const label of [
      'ارز (ریال)',
      'واحد مبادله',
      'روش گرد کردن',
      'گرد کردن اتوماتیک',
      'عنوان واحد فرعی به زبان دوم',
      'تعداد ارقام اعشار',
      'علامت',
      'انتخاب ریال',
    ])
      expect(html).toContain(label);
    expect(html).toMatch(/id="bank-rial-code"[^>]*value="IRR"/);
    expect(html).toMatch(/id="bank-rial-digits"[^>]*value="0"/);
    expect(html).not.toContain('ثبت و انتخاب ریال');
  });
  it('shows the seven compact B2C fields and keeps the traditional person form available', () => {
    const renderPerson = (compact: boolean) =>
      renderToStaticMarkup(
        <QueryClientProvider client={new QueryClient()}>
          <LedgerPersonDialog
            compact={compact}
            book={book}
            onSelected={vi.fn()}
            onClose={vi.fn()}
          />
        </QueryClientProvider>,
      );
    const html = renderPerson(true);
    for (const field of [
      'code',
      'gender',
      'firstName',
      'lastName',
      'nationalId',
      'birthDate',
      'mobile',
    ])
      expect(html).toContain('ledger-person-' + field);
    expect(html).toContain('افزودن مشتری حقیقی');
    expect(html).toContain('شماره تلفن');
    expect(html).toContain('<option value="M">آقا</option>');
    expect(html).toContain('<option value="F">خانم</option>');
    expect(html).not.toContain('ledger-person-salutation');
    expect(html).not.toContain('اطلاعات گردش کار');
    const original = renderPerson(false);
    expect(original).toContain('ledger-person-salutation');
    expect(original).toContain('اطلاعات گردش کار');
  });
  it('recognizes normalized legacy spellings without reclassifying person/company or arbitrary types', () => {
    expect(detailOwnerKind('حساب بانكي')).toBe('BANK');
    expect(detailOwnerKind('حساب‌های بانکی')).toBe('BANK');
    expect(detailOwnerKind('منبع تأمین اعتبار')).toBe('FUND');
    expect(detailOwnerKind('شخص')).toBeUndefined();
    expect(detailOwnerKind('نوع اختصاصی')).toBeUndefined();
  });
});
