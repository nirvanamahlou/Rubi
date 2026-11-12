import { contractGuidePath } from './contract-guides';
import type { SalesContractDetail } from '@nora/contracts';

const statuses: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  PENDING_CONFIRMATION: 'در انتظار تأیید',
  CONFIRMED: 'تأییدشده',
  SENT_TO_RESERVATIONS: 'ارسال‌شده به رزرواسیون',
  IN_PROGRESS: 'در حال انجام',
  COMPLETED: 'تکمیل‌شده',
  CANCELLED: 'باطل‌شده',
  NOT_SENT: 'ارسال نشده',
  QUEUED: 'در صف',
  ACCEPTED: 'پذیرفته‌شده',
  NEEDS_REVIEW: 'نیازمند بررسی',
  PARTIALLY_FULFILLED: 'بخشی اجرا شده',
  FULFILLED: 'اجرا شده',
  REJECTED: 'ردشده',
  UNPAID: 'پرداخت نشده',
  PARTIALLY_SETTLED: 'بخشی تسویه شده',
  SETTLED: 'تسویه شده',
  OVERPAID: 'اضافه پرداخت',
  FLIGHT: 'پرواز',
  HOTEL: 'هتل',
  VISA: 'ویزا',
  INSURANCE: 'بیمه',
  TRANSFER: 'ترانسفر',
  TOUR: 'تور',
  BUS: 'اتوبوس',
  TRAIN: 'قطار',
  CIP: 'CIP',
  OTHER: 'سایر',
};

export function contractInspectionText(data: SalesContractDetail): string {
  const next =
    data.status === 'CANCELLED'
      ? 'قرارداد باطل شده است. سابقه و علت ابطال را در پرونده قرارداد بررسی کنید.'
      : data.reservationStatus === 'NEEDS_REVIEW' ||
          data.reservationStatus === 'REJECTED'
        ? 'رزرواسیون نیاز به بررسی یا رد درخواست را ثبت کرده است. توضیح همان درخواست را در پرونده بررسی کنید و اصلاح لازم را با واحد رزرواسیون هماهنگ کنید.'
        : data.reservationStatus === 'NOT_SENT'
          ? 'ارسال به رزرواسیون ثبت نشده است. قرارداد را باز کنید و پیام عملیات «ثبت و ارسال به رزرواسیون» را بررسی کنید. پیام خطا علت دقیق مانع را مشخص می‌کند.'
          : data.reservationStatus === 'QUEUED'
            ? 'درخواست در صف رزرواسیون است. مرحله بعد، بررسی توسط رزرواسیون است.'
            : data.reservationStatus === 'FULFILLED'
              ? 'اجرای خدمات در رزرواسیون تکمیل شده است. مدارک سفر و وضعیت مجوز تحویل را از پرونده بررسی کنید.'
              : 'وضعیت اجرای خدمات و مدارک را در پرونده قرارداد و درخواست مرتبط رزرواسیون بررسی کنید.';
  return [
    `قرارداد ${data.contractNumber}`,
    `وضعیت قرارداد «${statuses[data.status] ?? data.status}»، تسویه «${statuses[data.settlementStatus] ?? data.settlementStatus}»، رزرواسیون «${statuses[data.reservationStatus] ?? data.reservationStatus}»`,
    `تعداد مسافران ثبت‌شده ${data.passengerCount ?? data.passengersDetail.length}`,
    `خدمات ${data.services.map((kind) => statuses[kind] ?? kind).join('، ')}`,
    ...data.balances.map(
      (balance) =>
        `ارز ${balance.currencyCode}، مبلغ ${balance.amount}، وصول تأییدشده ${balance.confirmedPaid}، در انتظار مالی ${balance.pendingFinance}، مانده ${balance.outstanding}`,
    ),
    next,
    contractGuidePath([
      'فروش و ارتباط با مشتری',
      'قرارداد',
      'ردیف قرارداد موردنظر',
    ]),
    `آخرین تغییر قرارداد ${data.updatedAt}`,
  ].join('\n');
}
