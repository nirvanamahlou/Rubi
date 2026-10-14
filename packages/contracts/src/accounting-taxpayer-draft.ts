export type TaxpayerDraftKind = 'settings' | 'cancellations' | 'schedules';
export interface AccountingTaxpayerDraft {
  id: string;
  version: number;
  kind: TaxpayerDraftKind;
  status: 'DRAFT';
  values: Record<string, string | boolean>;
  externalConnection: false;
  externalAcceptance: false;
  createdAt: string;
  legacyRequest?: boolean;
  storedSecretFields?: string[];
}
export const taxpayerDraftColumns: Record<
  TaxpayerDraftKind,
  Record<string, string>
> = {
  settings: {
    عنوان: 'txtTitle',
    'نوع ارسال صورت حساب': 'lkpSendingType_ComboBox_Input',
  },
  cancellations: {
    'شماره مالیاتی ابطال': 'txtUniqueBillNumber',
    'تاریخ ابطال': 'dpCancellationDate_MaskedTextBox',
    'شماره مالیاتی مرجع': 'txtUniqueBillNumberRef',
    'تاریخ مرجع': 'dpReferenceDate_MaskedTextBox',
    'موضوع مرجع': 'lkpReferenceActionType_ComboBox_Input',
    'شناسه موجودیت': 'txtReferenceRef',
  },
  schedules: {
    عنوان: 'txtTitle',
    'عملیات دسته جمعی': 'lkpOperatins_ComboBox_Input',
    'زمان اجرا': 'dpkRunTime_MaskedTextBox',
    'تاریخ اجرا': 'dpkRunTime_MaskedTextBox',
    'فاصله اجرا (روز)': 'txtOperationExecutionInterval',
    'نوع صورتحساب': 'lkpTaxPayerBillType_ComboBox_Input',
    'موضوع صورتحساب': 'lkpActionType_ComboBox_Input',
    'الگوی صورتحساب': 'lkpTaxPayerBillPattern_ComboBox_Input',
  },
};
export function taxpayerDraftColumn(
  row: AccountingTaxpayerDraft,
  label: string,
): string {
  if (label === 'وضعیت') return 'پیش‌نویس';
  if (label === 'متن خطا') return '';
  const key = taxpayerDraftColumns[row.kind][label];
  return key ? String(row.values[key] ?? '') : '';
}
