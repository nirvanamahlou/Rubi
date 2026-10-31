/** Options observed in the Radan UI. No payroll formula or unobserved provider behavior. */
export const HR_RADAN_CONTRACT_TYPES = [
  'قراردادی',
  'رسمی',
  'پیمانی',
  'ساعتی',
  'خدماتی-مشاوره‌ای',
  'دائمی (غیر موقت)',
  'موقت (مدت معین)',
  'معین',
  'آزمایشی',
  'آموزشی',
] as const;
export const HR_RADAN_LEAVE_TYPES = [
  'استحقاقی',
  'استعلاجی',
  'تشویقی',
  'بدون حقوق',
  'فوت بستگان درجه یک',
  'ازدواج',
  'زایمان',
] as const;
export const HR_RADAN_DEVICE_TYPES = [
  'V800',
  'رادن',
  'ZK',
  'TF8000',
  'V210',
] as const;
export const HR_RADAN_END_DAYS = [
  'همان روز',
  'یک روز بعد',
  'دو روز بعد',
] as const;
export const HR_RADAN_FIELD_OPTIONS: Readonly<
  Record<string, readonly string[]>
> = {
  'نوع دستگاه': HR_RADAN_DEVICE_TYPES,
  'روز پایان': HR_RADAN_END_DAYS,
  'نوع دورکاری': ['ساعتی', 'روزانه'],
};
/** Old persisted column positions must never move. Additions can be omitted by old clients. */
export const HR_RADAN_LEGACY_LENGTHS: Readonly<Record<string, number>> = {
  'employee.identity': 14,
  'time.leaveTransferRules': 9,
  'time.workingHours': 8,
  'time.biometric': 6,
};
export const HR_RADAN_REQUEST_RESOURCES = [
  'time.leave',
  'requests.leave',
  'time.corrections',
  'requests.attendance',
  'time.mission',
  'expenses.mission',
  'requests.travel',
  'time.overtime',
  'time.remote',
] as const;
