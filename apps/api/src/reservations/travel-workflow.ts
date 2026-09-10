import type {
  TravelWorkflowCommandV1,
  TravelWorkflowStateV1,
} from '@rubi/contracts';

export const initialTravelWorkflow = (): TravelWorkflowStateV1 => ({
  version: 0,
  supplierStatus: 'NEW',
  supplierReference: '',
  insuranceIssued: false,
  insuranceReference: '',
  voucherIssued: false,
  insuranceWarningAcknowledged: false,
  branding: null,
  roomOrder: [],
  ageOverrides: {},
  note: '',
  updatedAt: null,
  updatedByUserId: null,
});

/** Pure transition rules; untrusted commands are validated before any persistence. */
export function transitionTravelWorkflow(
  current: TravelWorkflowStateV1,
  command: TravelWorkflowCommandV1,
  passengerIds: readonly string[],
): TravelWorkflowStateV1 {
  if (
    !command ||
    !Number.isSafeInteger(command.expectedVersion) ||
    command.expectedVersion !== current.version
  )
    throw new Error('نسخه تغییر کرده است؛ اطلاعات را دوباره دریافت کنید.');
  if (
    typeof command.note !== 'string' ||
    !command.note.trim() ||
    command.note.trim().length > 500
  )
    throw new Error('دلیل عملیات را تا ۵۰۰ نویسه وارد کنید.');
  if (
    command.action !== 'NOTE' &&
    (current.supplierStatus === 'CANCELLED' || current.voucherIssued)
  )
    throw new Error('این درخواست بسته شده است و قابل تغییر نیست.');
  const next = {
    ...current,
    version: current.version + 1,
    note: command.note.trim(),
  };
  switch (command.action) {
    case 'NOTE':
      if ((current.reservationNotes?.length ?? 0) >= 100)
        throw new Error('حداکثر تعداد یادداشت‌ها ثبت شده است.');
      next.reservationNotes = [
        ...(current.reservationNotes ?? []),
        command.note.trim(),
      ];
      next.note = current.note;
      break;
    case 'BRANDING':
      break;
    case 'REQUEST_SUPPLIER':
      if (current.supplierStatus !== 'NEW')
        throw new Error('درخواست قبلاً برای کارگزار ثبت شده است.');
      next.supplierStatus = 'REQUESTED';
      break;
    case 'CONFIRM_SUPPLIER':
      if (current.supplierStatus !== 'REQUESTED')
        throw new Error('ابتدا ارسال درخواست برای کارگزار را ثبت کنید.');
      if (
        typeof command.supplierReference !== 'string' ||
        !command.supplierReference.trim() ||
        command.supplierReference.length > 200
      )
        throw new Error('مرجع تأیید کارگزار الزامی است.');
      if (
        !current.insuranceIssued &&
        command.acknowledgeMissingInsurance !== true
      )
        throw new Error('بیمه صادر نشده است؛ ادامه بدون بیمه را تأیید کنید.');
      next.voucherIssued = true;
      next.insuranceWarningAcknowledged = !current.insuranceIssued;
      next.supplierStatus = 'CONFIRMED';
      next.supplierReference = command.supplierReference.trim();
      break;
    case 'CANCEL':
      next.supplierStatus = 'CANCELLED';
      break;
    case 'INSURANCE':
      if (
        typeof command.insuranceReference !== 'string' ||
        !command.insuranceReference.trim() ||
        command.insuranceReference.length > 200
      )
        throw new Error('شماره بیمه‌نامه صادرشده الزامی است.');
      next.insuranceIssued = true;
      next.insuranceReference = command.insuranceReference.trim();
      break;
    case 'ISSUE_VOUCHER':
      if (current.supplierStatus !== 'CONFIRMED')
        throw new Error('ابتدا تأیید کارگزار را ثبت کنید.');
      if (
        !current.insuranceIssued &&
        command.acknowledgeMissingInsurance !== true
      )
        throw new Error('بیمه صادر نشده است؛ ادامه بدون بیمه را تأیید کنید.');
      next.voucherIssued = true;
      next.insuranceWarningAcknowledged = !current.insuranceIssued;
      break;
    case 'ARRANGEMENT': {
      if (
        !Array.isArray(command.roomOrder) ||
        command.roomOrder.length !== passengerIds.length ||
        new Set(command.roomOrder).size !== passengerIds.length ||
        command.roomOrder.some((id) => !passengerIds.includes(id))
      )
        throw new Error(
          'ترتیب اسکان باید همه مسافران همین قرارداد را دقیقاً یک بار داشته باشد.',
        );
      if (
        !command.ageOverrides ||
        typeof command.ageOverrides !== 'object' ||
        Array.isArray(command.ageOverrides) ||
        Object.entries(command.ageOverrides).some(
          ([id, age]) =>
            !passengerIds.includes(id) ||
            !['ADULT', 'CHILD', 'INFANT'].includes(age),
        )
      )
        throw new Error('رده سنی عملیاتی معتبر نیست.');
      next.roomOrder = [...command.roomOrder];
      next.ageOverrides = { ...command.ageOverrides };
      break;
    }
    default:
      throw new Error('عملیات معتبر نیست.');
  }
  return next;
}
