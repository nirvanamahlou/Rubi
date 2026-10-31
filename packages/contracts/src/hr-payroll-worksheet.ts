/** Versioned HR worksheet snapshots. Monetary inputs and results are integer IRR strings. */
export const PAYROLL_INPUTS = [
  'start',
  'name',
  'ot',
  'short',
  'daily',
  'seniority',
  'days',
  'housing',
  'food',
  'married',
  'tax',
  'agreed',
  'advance',
  'benefits',
  'account',
  'bank',
  'children',
  'childRate',
  'overtimeHourly',
  'shortageHourly',
] as const;
export type PayrollInput = (typeof PAYROLL_INPUTS)[number];
export type PayrollRow = Record<PayrollInput, string> & {
  id: string;
  employeeId?: string;
  children?: string;
  childRate?: string;
  overtimeHourly?: string;
  shortageHourly?: string;
};
export const PAYROLL_COLUMNS = [
  ['start', 'شروع کار'],
  ['name', 'نام و نام خانوادگی'],
  ['ot', 'اضافه کار (ساعت:دقیقه)'],
  ['short', 'کسر کار (ساعت:دقیقه)'],
  ['daily', 'دستمزد روزانه'],
  ['seniority', 'پایه سنوات'],
  ['days', 'روز کارکرد'],
  ['monthly', 'دستمزد ماهانه'],
  ['housing', 'حق مسکن'],
  ['food', 'بن کارگری'],
  ['married', 'حق تاهل'],
  ['children', 'تعداد فرزند'],
  ['childRate', 'حق اولاد هر فرزند'],
  ['childPay', 'حق اولاد'],
  ['overtimeHourly', 'نرخ هر ساعت اضافه کار'],
  ['shortageHourly', 'نرخ هر ساعت کسر کار'],
  ['subject', 'مزایا ماهانه مشمول'],
  ['employeeInsurance', 'حق بیمه سهم کارمند'],
  ['unemployment', 'حق بیمه بیکاری'],
  ['employerInsurance', 'حق بیمه سهم کارفرما'],
  ['insuranceTotal', 'پرداختی بیمه'],
  ['tax', 'مالیات حقوق'],
  ['legalNet', 'دریافتی طبق لیست بیمه'],
  ['agreed', 'توافق دریافتی'],
  ['advance', 'مساعده'],
  ['benefits', 'مزایا'],
  ['otPay', 'اضافه کاری'],
  ['shortPay', 'کسر کاری'],
  ['bonus', 'کارانه'],
  ['net', 'خالص دریافتی'],
  ['account', 'شماره حساب'],
  ['bank', 'بانک'],
] as const;
export type PayrollColumn = (typeof PAYROLL_COLUMNS)[number][0];
export interface PayrollRates {
  employee: number;
  unemployment: number;
  employer: number;
  overtime: number;
  dailyMinutes: number;
}
/** Rates are basis points; these are worksheet defaults, not a legal rate engine. */
export const PAYROLL_DEFAULT_RATES: PayrollRates = {
  employee: 700,
  unemployment: 300,
  employer: 2000,
  overtime: 14000,
  dailyMinutes: 480,
};
export interface PayrollSnapshot {
  rows: PayrollRow[];
  rates: PayrollRates;
}
export type PayrollWorksheetStatus =
  | 'DRAFT'
  | 'HR_APPROVED'
  | 'PENDING_FINANCE'
  | 'APPROVED'
  | 'CORRECTION_REQUIRED'
  | 'REJECTED'
  | 'CANCELLED';
export interface PayrollWorksheetFinanceSource {
  id: string;
  branchId: string;
  period: string;
  version: number;
  amount: string;
  currencyCode: 'IRR';
  rowCount: number;
}
export interface PayrollWorksheet extends PayrollSnapshot {
  id: string;
  branchId: string;
  period: string;
  version: number;
  status: PayrollWorksheetStatus;
  financeRequestId?: string;
  updatedAt: string;
}
export interface PayrollWorksheetSummary extends Omit<
  PayrollWorksheet,
  'rows' | 'rates'
> {
  rowCount: number;
}
export function payrollDigits(value: string) {
  return value
    .replace(/[۰-۹٠-٩]/g, (c) =>
      String(c.charCodeAt(0) - (c >= '۰' ? 1776 : 1632)),
    )
    .replace(/[,٬]/g, '')
    .trim();
}
export const isPayrollInput = (key: string): key is PayrollInput =>
  (PAYROLL_INPUTS as readonly string[]).includes(key);
export const payrollTextInput = (key: string) =>
  ['start', 'name', 'ot', 'short', 'account', 'bank'].includes(key);
export function payrollCell(key: PayrollInput, input: string): string {
  const value = payrollDigits(input);
  if (!value && ['overtimeHourly', 'shortageHourly'].includes(key)) return '';
  if (value.length > 160 || value.includes('\0'))
    throw new Error('مقدار سلول معتبر نیست.');
  if (key === 'ot' || key === 'short') {
    if (!value) return '0:00';
    if (!/^\d{1,3}:[0-5]\d$/.test(value))
      throw new Error('زمان را به شکل 08:30 وارد کنید.');
  } else if (key === 'start') {
    if (
      value &&
      !/^1[34]\d{2}\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/.test(value)
    )
      throw new Error('تاریخ را به شکل 1405/07/01 وارد کنید.');
  } else if (!payrollTextInput(key)) {
    if (!value) return '0';
    if (key === 'children' && Number(value) > 100)
      throw new Error('تعداد فرزند معتبر نیست.');
    if (!/^\d{1,12}$/.test(value) || (key === 'days' && Number(value) > 31))
      throw new Error('عدد واردشده معتبر نیست.');
    return BigInt(value).toString();
  }
  return value;
}
export function emptyPayrollRow(id: string): PayrollRow {
  return Object.fromEntries([
    ['id', id],
    ...PAYROLL_INPUTS.map((k) => [
      k,
      ['overtimeHourly', 'shortageHourly'].includes(k)
        ? ''
        : payrollTextInput(k)
          ? ['ot', 'short'].includes(k)
            ? '0:00'
            : ''
          : '0',
    ]),
  ]) as PayrollRow;
}
const rounded = (n: bigint, d: bigint) =>
  n < 0n ? -((-n + d / 2n) / d) : (n + d / 2n) / d;
export function calculatePayroll(
  row: PayrollRow,
  rates: PayrollRates,
): Record<PayrollColumn | 'remaining', string> {
  const n = (key: PayrollInput) => BigInt(row[key] || '0');
  const minutes = (key: 'ot' | 'short') => {
    const [h, m] = (row[key] || '0:00').split(':');
    return BigInt(h!) * 60n + BigInt(m!);
  };
  const monthly = (n('daily') + n('seniority')) * n('days');
  const subject = n('housing') + n('food') + n('married');
  const insurance = (rate: number) =>
    rounded((monthly + subject) * BigInt(rate), 10000n);
  const employeeInsurance = insurance(rates.employee),
    unemployment = insurance(rates.unemployment),
    employerInsurance = insurance(rates.employer);
  const childPay = n('children') * n('childRate');
  const legalNet = monthly + subject + childPay - employeeInsurance - n('tax');
  const otPay = row.overtimeHourly
    ? rounded(n('overtimeHourly') * minutes('ot'), 60n)
    : rounded(
        n('daily') * minutes('ot') * BigInt(rates.overtime),
        BigInt(rates.dailyMinutes) * 10000n,
      );
  const shortPay = row.shortageHourly
    ? rounded(n('shortageHourly') * minutes('short'), 60n)
    : rounded(n('daily') * minutes('short'), BigInt(rates.dailyMinutes));
  const bonus =
    n('agreed') - legalNet - n('advance') + n('benefits') + otPay - shortPay;
  const net = legalNet + n('advance') + bonus;
  return {
    ...row,
    childPay: childPay.toString(),
    monthly: monthly.toString(),
    subject: subject.toString(),
    employeeInsurance: employeeInsurance.toString(),
    unemployment: unemployment.toString(),
    employerInsurance: employerInsurance.toString(),
    insuranceTotal: (
      employeeInsurance +
      unemployment +
      employerInsurance
    ).toString(),
    legalNet: legalNet.toString(),
    otPay: otPay.toString(),
    shortPay: shortPay.toString(),
    bonus: bonus.toString(),
    net: net.toString(),
    remaining: (net - n('advance')).toString(),
  };
}

export const EMPLOYMENT_DEFAULTS = {
  married: '5000000',
  childRate: '16625550',
  housing: '30000000',
  food: '22000000',
  overtimeHourly: '',
  shortageHourly: '',
  days: '',
};
export const EMPLOYEE_PAY_DEFAULTS = {
  daily: '0',
  seniority: '0',
  children: '0',
};
export function payrollMonthDays(period: string) {
  const month = Number(period.split(/[-/]/)[1]);
  return String(month <= 6 ? 31 : month <= 11 ? 30 : 29);
}
