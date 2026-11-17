export const accountingDetailOwners = [
  { kind: 'PETTY_CASH', title: 'تنخواه' },
  { kind: 'CASH', title: 'صندوق' },
  { kind: 'BANK', title: 'حساب بانکی' },
  { kind: 'FISCAL_YEAR', title: 'دوره مالی' },
  { kind: 'FUND', title: 'منبع تامین اعتبار' },
  { kind: 'PROJECT', title: 'پروژه' },
  { kind: 'COST_CENTER', title: 'مرکز هزینه' },
  { kind: 'BRANCH', title: 'شعبه' },
] as const;
export type AccountingDetailOwnerKind =
  (typeof accountingDetailOwners)[number]['kind'];
export function detailOwnerKind(
  title: string,
): AccountingDetailOwnerKind | undefined {
  const key = (s: string) =>
    s
      .replaceAll('ي', 'ی')
      .replaceAll('ك', 'ک')
      .replace(/\s|‌/g, '')
      .replace('تأمین', 'تامین');
  return accountingDetailOwners.find((x) => key(x.title) === key(title))?.kind;
}
export interface AccountingDetailOwnerV1 {
  id: string;
  kind: AccountingDetailOwnerKind;
  code: string;
  title: string;
  titleEn: string;
  active: boolean;
  version: number;
  currency: string | null;
  configurationId: string | null;
  accountId: string | null;
  bankId?: string | null;
  attributes: Record<string, unknown>;
}
export interface AccountingDetailOwnerPageV1 {
  rows: AccountingDetailOwnerV1[];
  hasNext: boolean;
}
