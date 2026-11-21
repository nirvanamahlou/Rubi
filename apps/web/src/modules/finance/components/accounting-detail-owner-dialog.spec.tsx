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
import { BankInstitutionDialog } from './accounting-bank-reference-dialogs';
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
  it('recognizes normalized legacy spellings without reclassifying person/company or arbitrary types', () => {
    expect(detailOwnerKind('حساب بانكي')).toBe('BANK');
    expect(detailOwnerKind('حساب‌های بانکی')).toBe('BANK');
    expect(detailOwnerKind('منبع تأمین اعتبار')).toBe('FUND');
    expect(detailOwnerKind('شخص')).toBeUndefined();
    expect(detailOwnerKind('نوع اختصاصی')).toBeUndefined();
  });
});
