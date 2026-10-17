import {
  salesHotelGuestIds,
  salesPassengerCompositionMatches,
  salesTravelDate,
  type SalesFormState,
} from './sales-form';

/** One authoritative reason for both the passenger-step button and its message. */
export function salesPassengerStepError(
  state: SalesFormState,
  peopleDirty: boolean,
  hotelCapacityError: string | null,
): string | null {
  if (!state.customerId) return 'مشتری قرارداد را مشخص کنید.';
  if (!state.passengers.length) return 'حداقل یک مسافر اضافه کنید.';
  if (peopleDirty)
    return 'اطلاعات جدول را با دکمه «ثبت و تأیید افراد» تأیید کنید.';
  if (!state.passengers.every((p) => p.birthDate) || !salesTravelDate(state))
    return 'تاریخ تولد مسافران و تاریخ سفر را کامل کنید.';
  if (!salesPassengerCompositionMatches(state))
    return 'تعداد و رده سنی مسافران باید با ترکیب ثبت‌شده در مرحله اول یکسان باشد.';
  const guests = salesHotelGuestIds(state);
  if (state.serviceKinds.includes('HOTEL')) {
    if (!guests.length) return 'حداقل یک مهمان برای هتل انتخاب کنید.';
    if (hotelCapacityError) return hotelCapacityError;
  }
  if (state.serviceKinds.includes('VISA')) {
    const selected = new Set(state.visaApplicantIds ?? []);
    const applicants = state.passengers.filter((p) =>
      selected.has(p.customerId),
    );
    if (
      !state.visaComposition ||
      applicants.length !==
        state.visaComposition.adults + state.visaComposition.children
    )
      return 'افراد متقاضی ویزا را مطابق تعداد بزرگسال و کودک انتخاب کنید.';
  }
  const hasSharedService = state.serviceKinds.some(
    (kind) => kind !== 'HOTEL' && kind !== 'VISA',
  );
  const everyPassengerAssigned = state.passengers.every(
    ({ customerId }) =>
      hasSharedService ||
      (state.serviceKinds.includes('HOTEL') && guests.includes(customerId)) ||
      (state.serviceKinds.includes('VISA') &&
        state.visaApplicantIds?.includes(customerId)),
  );
  return everyPassengerAssigned
    ? null
    : 'هر مسافر باید حداقل یک خدمت انتخاب‌شده داشته باشد.';
}
