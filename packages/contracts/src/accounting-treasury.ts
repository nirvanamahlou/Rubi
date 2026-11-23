export const treasuryDocumentTypes = [
  'دریافت',
  'پرداخت',
  'انتقال',
  'صورت خلاصه تنخواه',
] as const;
export const treasuryDevices = ['کارت خوان', 'موبایل', 'اینترنت'] as const;
export const treasuryDefinitions = [
  {
    kind: 'bank-history',
    path: 'base-information/bank-history',
    title: 'تاریخچه حساب بانکی',
    form: 'BankAccountHistoryPages/GetReport.aspx',
  },
  {
    kind: 'petty-funds',
    path: 'petty-cash/funds',
    title: 'معرفی تنخواه',
    form: 'PettyCashPages/Edit.aspx',
  },
  {
    kind: 'cashboxes',
    path: 'base-information/cashboxes',
    title: 'صندوق',
    form: 'CashPages/Edit.aspx',
  },
  {
    kind: 'cashiers',
    path: 'base-information/cashier-history',
    title: 'تاریخچه صندوق داران',
    form: 'CashierHistoryPages/GetReport.aspx',
  },
  {
    kind: 'terminals',
    path: 'online/terminals',
    title: 'معرفی پایانه فروش',
    form: 'SalesTerminalPages/Edit.aspx',
  },
  {
    kind: 'banks',
    path: 'base-information/banks',
    title: 'معرفی بانک',
    form: 'BankPages/Edit.aspx',
  },
  {
    kind: 'bank-branches',
    path: 'base-information/bank-branches',
    title: 'معرفی شعبه بانک',
    form: 'BankBranchPages/Edit.aspx',
  },
  {
    kind: 'company-accounts',
    path: 'base-information/bank-accounts',
    title: 'معرفی حساب بانکی',
    form: 'BankAccountPages/Edit.aspx',
  },
  {
    kind: 'bank-account-types',
    path: 'base-information/bank-account-types',
    title: 'تعریف نوع حساب بانکی',
    form: 'BankAccountTypePages/Edit.aspx',
  },
  {
    kind: 'treasury-causes',
    path: 'base-information/causes',
    title: 'بابت',
    form: 'ReceiptAndPaymentCausePages/ReceiptAndPaymentCauseEditor.view',
  },
  {
    kind: 'payment-providers',
    path: 'online/payment-providers',
    title: 'معرفی شرکت خدمات پرداخت',
    form: 'PaymentServiceProviderCompanyPages/Edit.aspx',
  },
] as const;
export type TreasuryDefinition = (typeof treasuryDefinitions)[number];
