import { validateVoucherSettings } from './voucher-settings';
import type {
  TravelWorkflowCommandV1,
  TravelWorkflowStateV1,
} from '@nora/contracts';

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
    current.supplierStatus === 'CANCELLED' &&
    !['NOTE', 'VOUCHER_SETTINGS', 'REOPEN'].includes(command.action)
  )
    throw new Error('این درخواست بسته شده است و قابل تغییر نیست.');
  if (
    current.voucherIssued &&
    ![
      'NOTE',
      'VOUCHER_SETTINGS',
      'SUPPLIER_FORM_SETTINGS',
      'TABLE_STATUS',
    ].includes(command.action)
  )
    throw new Error('این درخواست بسته شده است و قابل تغییر نیست.');
  const next = {
    ...current,
    version: current.version + 1,
    note: command.note.trim(),
  };
  switch (command.action) {
    case 'TABLE_STATUS': {
      const keys = [
        'visaRequested',
        'visaConfirmed',
        'flightRequested',
        'flightConfirmed',
      ] as const;
      if (
        !command.tableFlag ||
        !keys.includes(command.tableFlag) ||
        typeof command.checked !== 'boolean'
      )
        throw new Error('وضعیت اقدام معتبر نیست.');
      const requested = command.tableFlag.startsWith('visa')
        ? 'visaRequested'
        : 'flightRequested';
      const confirmed = command.tableFlag.startsWith('visa')
        ? 'visaConfirmed'
        : 'flightConfirmed';
      if (
        command.tableFlag === confirmed &&
        command.checked &&
        !current.tableFlags?.[requested]?.checked
      )
        throw new Error('ابتدا تیک اقدام را ثبت کنید.');
      if (
        command.tableFlag === requested &&
        !command.checked &&
        current.tableFlags?.[confirmed]?.checked
      )
        throw new Error('ابتدا تیک تأیید را بردارید.');
      next.tableFlags = {
        ...current.tableFlags,
        [command.tableFlag]: {
          checked: command.checked,
          updatedAt: '',
          updatedByUserId: '',
        },
      };
      break;
    }
    case 'PREPARE_SUPPLIER_FORM': {
      if (!['NEW', 'REQUESTED'].includes(current.supplierStatus))
        throw new Error('آماده‌سازی فرم در این وضعیت ممکن نیست.');
      const settings = validateVoucherSettings(
        command.voucherSettings,
        passengerIds,
      );
      if (!settings.references?.brokerId)
        throw new Error('کارگزار را انتخاب کنید.');
      if (
        ![
          settings.flags.hotel,
          settings.flags.transfer,
          settings.flags.tourLeader,
          settings.flags.excursion,
        ].some(Boolean)
      )
        throw new Error('حداقل یک خدمت را انتخاب کنید.');
      next.supplierFormSettings = settings;
      next.supplierFormPrepared = true;
      delete next.voucherSettings;
      break;
    }
    case 'SUPPLIER_FORM_SETTINGS':
      if (command.applyToContractAndVoucher)
        throw new Error(
          'اصلاح عملیاتی فقط در فرم رزواسیون ثبت می‌شود و قرارداد فروش را تغییر نمی‌دهد.',
        );
      next.supplierFormSettings = validateVoucherSettings(
        command.voucherSettings,
        passengerIds,
      );
      break;
    case 'VOUCHER_SETTINGS':
      if (current.supplierStatus === 'CANCELLED')
        throw new Error('درخواست ابطال شده است.');
      next.voucherSettings = validateVoucherSettings(
        command.voucherSettings,
        passengerIds,
      );
      break;
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
      if (!['NEW', 'REQUESTED'].includes(current.supplierStatus))
        throw new Error('ثبت ارسال در این وضعیت ممکن نیست.');
      next.supplierStatus = 'REQUESTED';
      if (current.supplierFormSettings)
        next.sentSupplierFormSettings = structuredClone(
          current.supplierFormSettings,
        );
      next.sentSupplierFormVersion = next.version;
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
      if (
        current.supplierFormPrepared &&
        current.supplierFormSettings?.flags.tourLeader &&
        !current.voucherSettings?.references?.leaderId
      )
        throw new Error('تورلیدر کارگزار را برای واچر انتخاب و ثبت کنید.');
      if (current.supplierFormPrepared && !next.voucherSettings)
        next.voucherSettings = structuredClone(
          current.sentSupplierFormSettings ?? current.supplierFormSettings!,
        );
      next.voucherIssued = true;
      next.insuranceWarningAcknowledged = !current.insuranceIssued;
      next.supplierStatus = 'CONFIRMED';
      next.supplierReference = command.supplierReference.trim();
      break;
    case 'CANCEL':
      next.supplierStatus = 'CANCELLED';
      break;
    case 'REOPEN':
      if (current.supplierStatus !== 'CANCELLED')
        throw new Error('فقط درخواست ابطال‌شده قابل بازگردانی است.');
      next.supplierStatus = 'NEW';
      next.supplierReference = '';
      next.voucherIssued = false;
      next.insuranceWarningAcknowledged = false;
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
      if (
        current.supplierFormPrepared &&
        current.supplierFormSettings?.flags.tourLeader &&
        !current.voucherSettings?.references?.leaderId
      )
        throw new Error('تورلیدر کارگزار را برای واچر انتخاب و ثبت کنید.');
      if (current.supplierFormPrepared && !next.voucherSettings)
        next.voucherSettings = structuredClone(
          current.sentSupplierFormSettings ?? current.supplierFormSettings!,
        );
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
